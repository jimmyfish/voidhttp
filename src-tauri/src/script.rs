//! Pre-request and post-response scripts: Postman-style JavaScript run in QuickJS.
//!
//! Each run gets a fresh runtime with a memory cap, a stack cap and a deadline. The sandbox has no
//! network, file system or Tauri access: the script sees the request, the response and the variables
//! passed in as JSON, and hands back test results, console lines, variable changes and (before the send)
//! a changed request. The `pm` API lives in `script/prelude.js`; the app applies what comes back.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use rquickjs::context::EvalOptions;
use rquickjs::{Context, Ctx, Function, Runtime, Value};

const PRELUDE: &str = include_str!("script/prelude.js");
/// faker (English) for {{$random…}}, built by scripts/build-fake.mjs; evaluated only when a script first asks for one
const FAKE: &str = include_str!("script/fake.js");
const MEMORY_LIMIT: usize = 64 << 20;
const STACK_LIMIT: usize = 1 << 20;
const TIMEOUT: Duration = Duration::from_secs(10);

/// Runs one script. `input` is what the prelude reads (phase, request, response, variables);
/// the result is the prelude's `__finish()` JSON, with `error` set when the script threw.
#[tauri::command]
pub async fn run_script(code: String, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let input = input.to_string();
    tauri::async_runtime::spawn_blocking(move || run(&code, &input, TIMEOUT))
        .await
        .map_err(|e| format!("The script stopped unexpectedly: {e}"))?
}

fn opts(filename: &str) -> EvalOptions {
    let mut o = EvalOptions::default();
    // Postman scripts are sloppy-mode code: `x = 1` without a declaration must work
    o.strict = false;
    o.filename = Some(filename.into());
    o
}

/// What a thrown value says, through the prelude's `__fail` so the output carries it.
fn fail<'js>(ctx: &Ctx<'js>, err: Value<'js>, message: Option<&str>) -> rquickjs::Result<()> {
    let f: Function = ctx.globals().get("__fail")?;
    f.call((err, message))
}

pub fn run(code: &str, input: &str, timeout: Duration) -> Result<serde_json::Value, String> {
    let rt = Runtime::new().map_err(|e| e.to_string())?;
    rt.set_memory_limit(MEMORY_LIMIT);
    rt.set_max_stack_size(STACK_LIMIT);
    let deadline = Instant::now() + timeout;
    // the handler stops the script once the deadline passes; disarmed so the prelude can still report
    let armed = Arc::new(AtomicBool::new(true));
    let watch = armed.clone();
    rt.set_interrupt_handler(Some(Box::new(move || watch.load(Ordering::Relaxed) && Instant::now() > deadline)));
    let ctx = Context::full(&rt).map_err(|e| e.to_string())?;
    let secs = timeout.as_secs();
    let stopped = || format!("The script ran longer than {secs} s and was stopped");
    // reporting runs JS too: past the deadline the handler would stop it at once, so it is disarmed
    // for the report only, and armed again so nothing after it (promise jobs) escapes the limit
    let report = |ctx: &Ctx<'_>, over: bool| -> Result<(), String> {
        let err = ctx.catch();
        armed.store(false, Ordering::Relaxed);
        let msg = over.then(stopped);
        let r = fail(ctx, err, msg.as_deref()).map_err(|e| e.to_string());
        armed.store(true, Ordering::Relaxed);
        r
    };

    ctx.with(|ctx| -> Result<(), String> {
        ctx.globals().set("__input", input).map_err(|e| e.to_string())?;
        // the prelude calls this once, on the first {{$random…}}: most scripts never pay for faker
        let load_fake = Function::new(ctx.clone(), |ctx: Ctx<'_>| ctx.eval_with_options::<(), _>(FAKE, opts("faker")))
            .map_err(|e| e.to_string())?;
        ctx.globals().set("__loadFake", load_fake).map_err(|e| e.to_string())?;
        if ctx.eval_with_options::<(), _>(PRELUDE, opts("prelude")).is_err() {
            let e = format!("{:?}", ctx.catch());
            return Err(if e.contains("out of memory") {
                "The response is too large for scripts to read".into()
            } else {
                format!("The script sandbox did not start: {e}")
            });
        }
        if let Err(rquickjs::Error::Exception) = ctx.eval_with_options::<(), _>(code, opts("script")) {
            report(&ctx, Instant::now() > deadline)?;
        }
        Ok(())
    })?;

    // settle promises (async tests, `.then` chains); a job that throws is reported like a script error
    // the deadline holds here too: a job that keeps queueing jobs stops when time is up
    while Instant::now() <= deadline {
        match rt.execute_pending_job() {
            Ok(true) => continue,
            Ok(false) => break,
            Err(job) => job.0.with(|ctx| report(&ctx, Instant::now() > deadline))?,
        }
    }
    if Instant::now() > deadline && rt.is_job_pending() {
        ctx.with(|ctx| {
            armed.store(false, Ordering::Relaxed);
            let msg = stopped();
            fail(&ctx, Value::new_undefined(ctx.clone()), Some(&msg)).map_err(|e| e.to_string())
        })?;
    }

    armed.store(false, Ordering::Relaxed);
    ctx.with(|ctx| {
        let json: String = ctx.eval("__finish()").map_err(|_| format!("The script's results could not be read: {:?}", ctx.catch()))?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value as J};

    fn go(code: &str, input: J) -> J {
        run(code, &input.to_string(), Duration::from_secs(2)).expect("run")
    }

    fn post() -> J {
        json!({
            "phase": "post",
            "request": { "method": "POST", "url": "{{baseUrl}}/v1/customers", "headers": [], "body": { "raw": "{}" } },
            "response": {
                "code": 201, "status": "Created", "responseTime": 142, "size": 40,
                "headers": [{ "key": "Content-Type", "value": "application/json" }],
                "body": "{\"id\":\"cus_8f2c41\",\"currency\":\"EUR\",\"items\":[1,2,3]}"
            },
            "environment": { "name": "Staging", "values": { "token": "abc" } },
            "collectionVariables": {},
            "inCollection": true
        })
    }

    #[test]
    fn tests_pass_and_fail_with_chai_messages() {
        let out = go(
            r#"
pm.test("Status is 201", () => pm.response.to.have.status(201));
const body = pm.response.json();
pm.test("Has id", () => { pm.expect(body.id).to.match(/^cus_/); });
pm.test("Currency is IDR", () => {
  pm.expect(body.currency).to.eql("IDR");
});
pm.test("Three items", () => pm.expect(body.items).to.have.length(3));
pm.test("Item count above 2", () => pm.expect(body.items).to.have.length.above(2));
pm.test("Has keys", () => pm.expect(body).to.include.keys("id"));
pm.test("Fast", () => pm.expect(pm.response.responseTime).to.be.below(500));
pm.test("Header", () => pm.response.to.have.header("content-type"));
pm.test("Not 404", () => pm.expect(pm.response.code).to.not.equal(404));
tests["legacy"] = responseCode.code === 201;
"#,
            post(),
        );
        let tests = out["tests"].as_array().unwrap();
        let failed: Vec<_> = tests.iter().filter(|t| t["passed"] == false).collect();
        assert_eq!(tests.len(), 10, "{out}");
        assert_eq!(failed.len(), 1, "{out}");
        assert_eq!(failed[0]["name"], "Currency is IDR");
        assert_eq!(failed[0]["error"], "AssertionError: expected 'EUR' to deeply equal 'IDR'");
        assert_eq!(failed[0]["line"], 6);
        assert!(out["error"].is_null());
    }

    #[test]
    fn variable_changes_and_console_come_back() {
        let out = go(
            r#"
pm.environment.set("customerId", pm.response.json().id);
pm.collectionVariables.set("n", 5);
pm.variables.set("local", "x");
console.log("got", { id: 1 }, [1, "a"]);
"#,
            post(),
        );
        let vars = out["vars"].as_array().unwrap();
        assert_eq!(vars[0], json!({ "scope": "environment", "op": "set", "key": "customerId", "value": "cus_8f2c41" }));
        assert_eq!(vars[1]["value"], "5");
        assert_eq!(out["locals"]["local"], "x");
        let logs = out["logs"].as_array().unwrap();
        assert!(logs.iter().any(|l| l["text"] == r#"got { id: 1 } [ 1, "a" ]"#), "{out}");
    }

    #[test]
    fn pre_request_changes_the_request() {
        let out = go(
            r#"
pm.request.headers.add({ key: "X-Id", value: pm.variables.replaceIn("{{token}}-{{$guid}}") });
pm.request.url.query.add({ key: "page", value: 2 });
pm.request.body.raw = JSON.stringify({ a: 1 });
"#,
            json!({
                "phase": "pre",
                "request": { "method": "POST", "url": "{{baseUrl}}/v1/customers", "headers": [{ "key": "Accept", "value": "*/*" }], "body": { "raw": "{}" } },
                "environment": { "name": "Staging", "values": { "token": "abc" } },
                "collectionVariables": {},
                "inCollection": false
            }),
        );
        let req = &out["request"];
        assert_eq!(req["url"], "{{baseUrl}}/v1/customers?page=2");
        assert_eq!(req["headers"][1]["key"], "X-Id");
        assert!(req["headers"][1]["value"].as_str().unwrap().starts_with("abc-"));
        assert_eq!(req["body"]["raw"], r#"{"a":1}"#);
    }

    #[test]
    fn untouched_request_is_not_returned() {
        let out = go("1 + 1", json!({ "phase": "pre", "request": { "method": "GET", "url": "x", "headers": [], "body": null } }));
        assert!(out["request"].is_null());
    }

    #[test]
    fn errors_carry_the_line() {
        let out = go("const a = 1;\n\nundefined.raw;", post());
        assert_eq!(out["error"]["name"], "TypeError");
        assert_eq!(out["error"]["line"], 3);
        let out = go("let x = ;", post());
        assert_eq!(out["error"]["name"], "SyntaxError");
    }

    #[test]
    fn no_environment_warns_instead_of_keeping() {
        let mut input = post();
        input["environment"] = J::Null;
        let out = go(r#"pm.environment.set("a", "1");"#, input);
        assert!(out["vars"].as_array().unwrap().is_empty());
        assert_eq!(out["logs"][0]["level"], "warn");
    }

    #[test]
    fn endless_loop_is_stopped() {
        let t = Instant::now();
        let out = run("while (true) {}", &post().to_string(), Duration::from_millis(300)).unwrap();
        assert!(t.elapsed() < Duration::from_secs(3));
        assert!(out["error"]["message"].as_str().unwrap().contains("longer than"), "{out}");
    }

    #[test]
    fn endless_promise_jobs_are_stopped() {
        let t = Instant::now();
        let code = "Promise.resolve().then(function f() { Promise.resolve().then(f); }); while (true) {}";
        let out = run(code, &post().to_string(), Duration::from_millis(300)).unwrap();
        assert!(t.elapsed() < Duration::from_secs(3));
        assert!(out["error"]["message"].as_str().unwrap().contains("longer than"), "{out}");
        let out = run("Promise.resolve().then(function f() { Promise.resolve().then(f); });", &post().to_string(), Duration::from_millis(300)).unwrap();
        assert!(out["error"]["message"].as_str().unwrap().contains("longer than"), "{out}");
    }

    #[test]
    fn unsettled_async_test_fails() {
        let out = go(r#"pm.test("never", () => new Promise(() => {}));"#, post());
        assert_eq!(out["tests"][0]["passed"], false, "{out}");
    }

    #[test]
    fn chai_edges() {
        let out = go(
            r#"
pm.test("multiset", () => pm.expect([1, 1, 2]).to.have.members([1, 2, 2]));
pm.test("not array", () => pm.expect("abc").to.have.members([]));
pm.test("chain", () => { pm.response.to.be.ok.and.have.status(201); });
pm.request.url.query.add({ key: "q", value: "a&b #c" });
"#,
            post(),
        );
        let t = out["tests"].as_array().unwrap();
        assert_eq!(t[0]["passed"], false, "{out}");
        assert_eq!(t[1]["passed"], false, "{out}");
        assert_eq!(t[2]["passed"], true, "{out}");
    }

    #[test]
    fn query_values_are_encoded() {
        let out = go(
            r#"pm.request.url.query.add({ key: "q", value: "a&b #c" }); pm.request.url.query.add({ key: "v", value: "{{token}}" });"#,
            json!({ "phase": "pre", "request": { "method": "GET", "url": "x", "headers": [], "body": null } }),
        );
        assert_eq!(out["request"]["url"], "x?q=a%26b%20%23c&v={{token}}");
    }

    #[test]
    fn console_is_capped() {
        let out = go("for (let i = 0; i < 5000; i++) console.log(i);", post());
        let logs = out["logs"].as_array().unwrap();
        assert!(logs.len() <= 1001, "{}", logs.len());
        assert!(logs.last().unwrap()["text"].as_str().unwrap().contains("more lines"));
    }

    #[test]
    fn async_tests_settle() {
        let out = go(r#"pm.test("later", async () => { await null; pm.expect(1).to.equal(2); });"#, post());
        assert_eq!(out["tests"][0]["passed"], false, "{out}");
    }

    #[test]
    fn no_host_access() {
        let out = go(r#"pm.test("sandbox", () => { pm.expect(typeof fetch).to.equal("undefined"); pm.expect(typeof __TAURI__).to.equal("undefined"); }); require("fs");"#, post());
        assert_eq!(out["tests"][0]["passed"], true, "{out}");
        assert!(out["error"]["message"].as_str().unwrap().contains("require('fs')"));
    }

    #[test]
    fn faker_names_resolve_and_load_only_on_use() {
        let out = go(
            r#"
pm.test("not loaded yet", () => pm.expect(typeof __voidFake).to.equal("undefined"));
const name = pm.variables.replaceIn("{{$randomFirstName}} {{$randomLastName}}");
pm.test("names", () => pm.expect(name).to.match(/^\S+ \S+$/).and.not.include("{{"));
pm.test("email", () => pm.expect(pm.variables.replaceIn("{{$randomEmail}}")).to.include("@"));
pm.test("date", () => pm.expect(pm.variables.replaceIn("{{$randomDatePast}}")).to.not.include("{{"));
pm.test("unknown stays", () => pm.expect(pm.variables.replaceIn("{{$randomNope}}")).to.equal("{{$randomNope}}"));
pm.test("built-in int", () => pm.expect(Number(pm.variables.replaceIn("{{$randomInt}}"))).to.be.within(0, 1000));
"#,
            post(),
        );
        let failed: Vec<_> = out["tests"].as_array().unwrap().iter().filter(|t| t["passed"] == false).collect();
        assert!(failed.is_empty(), "{out}");
        assert!(out["error"].is_null(), "{out}");
    }
}
