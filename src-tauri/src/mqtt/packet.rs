//! MQTT control packets, 3.1.1 (protocol level 4) and 5.0 (level 5), both ways: the client
//! writes CONNECT, PUBLISH, SUBSCRIBE and reads the broker's answers; the tests play broker with
//! the same code. Specs: <https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html> and
//! <https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html>.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Version {
    V311,
    V5,
}

impl Version {
    pub fn level(self) -> u8 {
        match self {
            Version::V311 => 4,
            Version::V5 => 5,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Version::V311 => "3.1.1",
            Version::V5 => "5.0",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// the bytes break the protocol
    Malformed(String),
    /// the packet is bigger than we accept
    TooLarge(usize),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Malformed(m) => write!(f, "Malformed packet: {m}"),
            Error::TooLarge(n) => write!(f, "Packet of {n} bytes is over the limit"),
        }
    }
}

fn bad<T>(m: impl Into<String>) -> Result<T, Error> {
    Err(Error::Malformed(m.into()))
}

// ---------- properties (MQTT 5) ----------

/// Every MQTT 5 property a client meets. Absent = None / empty.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Props {
    pub payload_format: Option<u8>,
    pub message_expiry: Option<u32>,
    pub content_type: Option<String>,
    pub response_topic: Option<String>,
    pub correlation: Option<Vec<u8>>,
    pub subscription_ids: Vec<u32>,
    pub session_expiry: Option<u32>,
    pub assigned_client_id: Option<String>,
    pub server_keep_alive: Option<u16>,
    pub auth_method: Option<String>,
    pub auth_data: Option<Vec<u8>>,
    pub request_problem_info: Option<u8>,
    pub will_delay: Option<u32>,
    pub request_response_info: Option<u8>,
    pub response_info: Option<String>,
    pub server_reference: Option<String>,
    pub reason_string: Option<String>,
    pub receive_max: Option<u16>,
    pub topic_alias_max: Option<u16>,
    pub topic_alias: Option<u16>,
    pub max_qos: Option<u8>,
    pub retain_available: Option<u8>,
    pub user: Vec<(String, String)>,
    pub max_packet_size: Option<u32>,
    pub wildcard_available: Option<u8>,
    pub sub_ids_available: Option<u8>,
    pub shared_available: Option<u8>,
}

impl Props {
    pub fn is_empty(&self) -> bool {
        *self == Props::default()
    }

    fn write(&self, out: &mut Vec<u8>) {
        let mut b = Vec::new();
        let u8p = |b: &mut Vec<u8>, id: u8, v: Option<u8>| {
            if let Some(v) = v {
                b.push(id);
                b.push(v);
            }
        };
        let u16p = |b: &mut Vec<u8>, id: u8, v: Option<u16>| {
            if let Some(v) = v {
                b.push(id);
                b.extend_from_slice(&v.to_be_bytes());
            }
        };
        let u32p = |b: &mut Vec<u8>, id: u8, v: Option<u32>| {
            if let Some(v) = v {
                b.push(id);
                b.extend_from_slice(&v.to_be_bytes());
            }
        };
        let strp = |b: &mut Vec<u8>, id: u8, v: &Option<String>| {
            if let Some(v) = v {
                b.push(id);
                put_str(b, v);
            }
        };
        let binp = |b: &mut Vec<u8>, id: u8, v: &Option<Vec<u8>>| {
            if let Some(v) = v {
                b.push(id);
                put_bin(b, v);
            }
        };
        u8p(&mut b, 0x01, self.payload_format);
        u32p(&mut b, 0x02, self.message_expiry);
        strp(&mut b, 0x03, &self.content_type);
        strp(&mut b, 0x08, &self.response_topic);
        binp(&mut b, 0x09, &self.correlation);
        for id in &self.subscription_ids {
            b.push(0x0B);
            put_varint(&mut b, *id as usize);
        }
        u32p(&mut b, 0x11, self.session_expiry);
        strp(&mut b, 0x12, &self.assigned_client_id);
        u16p(&mut b, 0x13, self.server_keep_alive);
        strp(&mut b, 0x15, &self.auth_method);
        binp(&mut b, 0x16, &self.auth_data);
        u8p(&mut b, 0x17, self.request_problem_info);
        u32p(&mut b, 0x18, self.will_delay);
        u8p(&mut b, 0x19, self.request_response_info);
        strp(&mut b, 0x1A, &self.response_info);
        strp(&mut b, 0x1C, &self.server_reference);
        strp(&mut b, 0x1F, &self.reason_string);
        u16p(&mut b, 0x21, self.receive_max);
        u16p(&mut b, 0x22, self.topic_alias_max);
        u16p(&mut b, 0x23, self.topic_alias);
        u8p(&mut b, 0x24, self.max_qos);
        u8p(&mut b, 0x25, self.retain_available);
        for (k, v) in &self.user {
            b.push(0x26);
            put_str(&mut b, k);
            put_str(&mut b, v);
        }
        u32p(&mut b, 0x27, self.max_packet_size);
        u8p(&mut b, 0x28, self.wildcard_available);
        u8p(&mut b, 0x29, self.sub_ids_available);
        u8p(&mut b, 0x2A, self.shared_available);
        put_varint(out, b.len());
        out.extend_from_slice(&b);
    }

    fn read(r: &mut Reader) -> Result<Self, Error> {
        let len = r.varint()?;
        let mut p = r.sub(len)?;
        let mut out = Props::default();
        fn once<T>(slot: &mut Option<T>, v: T, id: u8) -> Result<(), Error> {
            if slot.is_some() {
                return bad(format!("property 0x{id:02X} appears twice"));
            }
            *slot = Some(v);
            Ok(())
        }
        while !p.done() {
            let id = p.u8()?;
            match id {
                0x01 => once(&mut out.payload_format, p.u8()?, id)?,
                0x02 => once(&mut out.message_expiry, p.u32()?, id)?,
                0x03 => once(&mut out.content_type, p.string()?, id)?,
                0x08 => once(&mut out.response_topic, p.string()?, id)?,
                0x09 => once(&mut out.correlation, p.bin()?, id)?,
                0x0B => out.subscription_ids.push(p.varint()? as u32),
                0x11 => once(&mut out.session_expiry, p.u32()?, id)?,
                0x12 => once(&mut out.assigned_client_id, p.string()?, id)?,
                0x13 => once(&mut out.server_keep_alive, p.u16()?, id)?,
                0x15 => once(&mut out.auth_method, p.string()?, id)?,
                0x16 => once(&mut out.auth_data, p.bin()?, id)?,
                0x17 => once(&mut out.request_problem_info, p.u8()?, id)?,
                0x18 => once(&mut out.will_delay, p.u32()?, id)?,
                0x19 => once(&mut out.request_response_info, p.u8()?, id)?,
                0x1A => once(&mut out.response_info, p.string()?, id)?,
                0x1C => once(&mut out.server_reference, p.string()?, id)?,
                0x1F => once(&mut out.reason_string, p.string()?, id)?,
                0x21 => once(&mut out.receive_max, p.u16()?, id)?,
                0x22 => once(&mut out.topic_alias_max, p.u16()?, id)?,
                0x23 => once(&mut out.topic_alias, p.u16()?, id)?,
                0x24 => once(&mut out.max_qos, p.u8()?, id)?,
                0x25 => once(&mut out.retain_available, p.u8()?, id)?,
                0x26 => {
                    let k = p.string()?;
                    let v = p.string()?;
                    out.user.push((k, v));
                }
                0x27 => once(&mut out.max_packet_size, p.u32()?, id)?,
                0x28 => once(&mut out.wildcard_available, p.u8()?, id)?,
                0x29 => once(&mut out.sub_ids_available, p.u8()?, id)?,
                0x2A => once(&mut out.shared_available, p.u8()?, id)?,
                other => return bad(format!("unknown property 0x{other:02X}")),
            }
        }
        Ok(out)
    }
}

// ---------- packets ----------

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Will {
    pub topic: String,
    pub payload: Vec<u8>,
    pub qos: u8,
    pub retain: bool,
    pub props: Props,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Connect {
    pub version: Version,
    pub client_id: String,
    pub clean_start: bool,
    pub keep_alive: u16,
    pub username: Option<String>,
    pub password: Option<Vec<u8>>,
    pub will: Option<Will>,
    pub props: Props,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConnAck {
    pub session_present: bool,
    /// MQTT 5 reason code; for 3.1.1 the return code (0-5)
    pub code: u8,
    pub props: Props,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Publish {
    pub dup: bool,
    pub qos: u8,
    pub retain: bool,
    pub topic: String,
    /// only for QoS 1 and 2
    pub pid: Option<u16>,
    pub props: Props,
    pub payload: Vec<u8>,
}

/// PUBACK, PUBREC, PUBREL, PUBCOMP
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ack {
    pub pid: u16,
    pub code: u8,
    pub props: Props,
}

impl Ack {
    pub fn ok(pid: u16) -> Self {
        Self { pid, code: 0, props: Props::default() }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubOpts {
    pub qos: u8,
    pub no_local: bool,
    pub retain_as_published: bool,
    /// 0 send retained, 1 only for a new subscription, 2 never
    pub retain_handling: u8,
}

impl SubOpts {
    pub fn qos(qos: u8) -> Self {
        Self { qos, no_local: false, retain_as_published: false, retain_handling: 0 }
    }
    fn byte(&self, v: Version) -> u8 {
        match v {
            Version::V311 => self.qos & 3,
            Version::V5 => (self.qos & 3) | (self.no_local as u8) << 2 | (self.retain_as_published as u8) << 3 | (self.retain_handling & 3) << 4,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Subscribe {
    pub pid: u16,
    pub props: Props,
    pub filters: Vec<(String, SubOpts)>,
}

/// SUBACK and UNSUBACK: one code per filter (3.1.1 UNSUBACK has none)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubAck {
    pub pid: u16,
    pub props: Props,
    pub codes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Unsubscribe {
    pub pid: u16,
    pub props: Props,
    pub filters: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Disconnect {
    pub code: u8,
    pub props: Props,
}

#[derive(Debug, Clone, PartialEq, Eq)]
// CONNECT is the big one and is built once per connection; boxing it buys nothing
#[allow(clippy::large_enum_variant)]
pub enum Packet {
    Connect(Connect),
    ConnAck(ConnAck),
    Publish(Publish),
    PubAck(Ack),
    PubRec(Ack),
    PubRel(Ack),
    PubComp(Ack),
    Subscribe(Subscribe),
    SubAck(SubAck),
    Unsubscribe(Unsubscribe),
    UnsubAck(SubAck),
    PingReq,
    PingResp,
    Disconnect(Disconnect),
    /// MQTT 5 enhanced auth
    Auth(Disconnect),
}

impl Packet {
    pub fn name(&self) -> &'static str {
        match self {
            Packet::Connect(_) => "CONNECT",
            Packet::ConnAck(_) => "CONNACK",
            Packet::Publish(_) => "PUBLISH",
            Packet::PubAck(_) => "PUBACK",
            Packet::PubRec(_) => "PUBREC",
            Packet::PubRel(_) => "PUBREL",
            Packet::PubComp(_) => "PUBCOMP",
            Packet::Subscribe(_) => "SUBSCRIBE",
            Packet::SubAck(_) => "SUBACK",
            Packet::Unsubscribe(_) => "UNSUBSCRIBE",
            Packet::UnsubAck(_) => "UNSUBACK",
            Packet::PingReq => "PINGREQ",
            Packet::PingResp => "PINGRESP",
            Packet::Disconnect(_) => "DISCONNECT",
            Packet::Auth(_) => "AUTH",
        }
    }

    /// The packet as bytes on the wire.
    pub fn encode(&self, v: Version) -> Vec<u8> {
        let v5 = v == Version::V5;
        let mut body = Vec::new();
        let first: u8 = match self {
            Packet::Connect(c) => {
                put_str(&mut body, "MQTT");
                body.push(c.version.level());
                let mut flags = 0u8;
                if c.username.is_some() {
                    flags |= 0x80;
                }
                if c.password.is_some() {
                    flags |= 0x40;
                }
                if let Some(w) = &c.will {
                    flags |= 0x04 | (w.qos & 3) << 3;
                    if w.retain {
                        flags |= 0x20;
                    }
                }
                if c.clean_start {
                    flags |= 0x02;
                }
                body.push(flags);
                body.extend_from_slice(&c.keep_alive.to_be_bytes());
                if c.version == Version::V5 {
                    c.props.write(&mut body);
                }
                put_str(&mut body, &c.client_id);
                if let Some(w) = &c.will {
                    if c.version == Version::V5 {
                        w.props.write(&mut body);
                    }
                    put_str(&mut body, &w.topic);
                    put_bin(&mut body, &w.payload);
                }
                if let Some(u) = &c.username {
                    put_str(&mut body, u);
                }
                if let Some(p) = &c.password {
                    put_bin(&mut body, p);
                }
                0x10
            }
            Packet::ConnAck(a) => {
                body.push(a.session_present as u8);
                body.push(a.code);
                if v5 {
                    a.props.write(&mut body);
                }
                0x20
            }
            Packet::Publish(p) => {
                put_str(&mut body, &p.topic);
                if p.qos > 0 {
                    body.extend_from_slice(&p.pid.unwrap_or(0).to_be_bytes());
                }
                if v5 {
                    p.props.write(&mut body);
                }
                body.extend_from_slice(&p.payload);
                0x30 | (p.dup as u8) << 3 | (p.qos & 3) << 1 | p.retain as u8
            }
            Packet::PubAck(a) | Packet::PubRec(a) | Packet::PubRel(a) | Packet::PubComp(a) => {
                body.extend_from_slice(&a.pid.to_be_bytes());
                // MQTT 5 leaves out a Success code with no properties
                if v5 && (a.code != 0 || !a.props.is_empty()) {
                    body.push(a.code);
                    if !a.props.is_empty() {
                        a.props.write(&mut body);
                    }
                }
                match self {
                    Packet::PubAck(_) => 0x40,
                    Packet::PubRec(_) => 0x50,
                    Packet::PubRel(_) => 0x62,
                    _ => 0x70,
                }
            }
            Packet::Subscribe(s) => {
                body.extend_from_slice(&s.pid.to_be_bytes());
                if v5 {
                    s.props.write(&mut body);
                }
                for (f, o) in &s.filters {
                    put_str(&mut body, f);
                    body.push(o.byte(v));
                }
                0x82
            }
            Packet::SubAck(a) | Packet::UnsubAck(a) => {
                body.extend_from_slice(&a.pid.to_be_bytes());
                if v5 {
                    a.props.write(&mut body);
                }
                if v5 || matches!(self, Packet::SubAck(_)) {
                    body.extend_from_slice(&a.codes);
                }
                if matches!(self, Packet::SubAck(_)) {
                    0x90
                } else {
                    0xB0
                }
            }
            Packet::Unsubscribe(u) => {
                body.extend_from_slice(&u.pid.to_be_bytes());
                if v5 {
                    u.props.write(&mut body);
                }
                for f in &u.filters {
                    put_str(&mut body, f);
                }
                0xA2
            }
            Packet::PingReq => 0xC0,
            Packet::PingResp => 0xD0,
            Packet::Disconnect(d) | Packet::Auth(d) => {
                if v5 && (d.code != 0 || !d.props.is_empty()) {
                    body.push(d.code);
                    if !d.props.is_empty() {
                        d.props.write(&mut body);
                    }
                }
                if matches!(self, Packet::Disconnect(_)) {
                    0xE0
                } else {
                    0xF0
                }
            }
        };
        let mut out = Vec::with_capacity(body.len() + 5);
        out.push(first);
        put_varint(&mut out, body.len());
        out.extend_from_slice(&body);
        out
    }
}

/// Reads one packet from the front of `buf`. Ok(None) while it is not all there yet;
/// otherwise the packet and how many bytes it took. `max` caps the whole packet.
pub fn decode(buf: &[u8], v: Version, max: usize) -> Result<Option<(Packet, usize)>, Error> {
    if buf.len() < 2 {
        return Ok(None);
    }
    let first = buf[0];
    // remaining length: up to four 7-bit groups
    let mut len: usize = 0;
    let mut i = 1;
    loop {
        if i > 4 {
            return bad("remaining length longer than 4 bytes");
        }
        let Some(&b) = buf.get(i) else { return Ok(None) };
        len |= ((b & 0x7F) as usize) << (7 * (i - 1));
        i += 1;
        if b & 0x80 == 0 {
            break;
        }
    }
    let total = i + len;
    if total > max {
        return Err(Error::TooLarge(total));
    }
    if buf.len() < total {
        return Ok(None);
    }
    let mut r = Reader { b: &buf[i..total], at: 0 };
    let packet = parse(first, &mut r, v)?;
    Ok(Some((packet, total)))
}

fn parse(first: u8, r: &mut Reader, v: Version) -> Result<Packet, Error> {
    let v5 = v == Version::V5;
    let kind = first >> 4;
    let flags = first & 0x0F;
    let want_flags = |want: u8| -> Result<(), Error> {
        if flags != want {
            return bad(format!("wrong fixed-header flags {flags:#06b} for packet type {kind}"));
        }
        Ok(())
    };
    let props = |r: &mut Reader| -> Result<Props, Error> {
        if v5 {
            Props::read(r)
        } else {
            Ok(Props::default())
        }
    };
    let packet = match kind {
        1 => {
            want_flags(0)?;
            let name = r.string()?;
            let level = r.u8()?;
            if name != "MQTT" && name != "MQIsdp" {
                return bad(format!("protocol name {name:?}"));
            }
            let version = match level {
                4 => Version::V311,
                5 => Version::V5,
                l => return bad(format!("protocol level {l}")),
            };
            let f = r.u8()?;
            if f & 1 != 0 {
                return bad("reserved connect flag set");
            }
            let keep_alive = r.u16()?;
            let props = if version == Version::V5 { Props::read(r)? } else { Props::default() };
            let client_id = r.string()?;
            let will = if f & 0x04 != 0 {
                let wprops = if version == Version::V5 { Props::read(r)? } else { Props::default() };
                let topic = r.string()?;
                let payload = r.bin()?;
                Some(Will { topic, payload, qos: (f >> 3) & 3, retain: f & 0x20 != 0, props: wprops })
            } else {
                None
            };
            let username = if f & 0x80 != 0 { Some(r.string()?) } else { None };
            let password = if f & 0x40 != 0 { Some(r.bin()?) } else { None };
            Packet::Connect(Connect { version, client_id, clean_start: f & 0x02 != 0, keep_alive, username, password, will, props })
        }
        2 => {
            want_flags(0)?;
            let ack_flags = r.u8()?;
            if ack_flags & 0xFE != 0 {
                return bad("reserved connack flags set");
            }
            let code = r.u8()?;
            let props = if v5 && !r.done() { Props::read(r)? } else { Props::default() };
            Packet::ConnAck(ConnAck { session_present: ack_flags & 1 != 0, code, props })
        }
        3 => {
            let qos = (flags >> 1) & 3;
            if qos == 3 {
                return bad("PUBLISH with QoS 3");
            }
            let topic = r.string()?;
            let pid = if qos > 0 { Some(r.u16()?) } else { None };
            if pid == Some(0) {
                return bad("PUBLISH with packet id 0");
            }
            let props = props(r)?;
            let payload = r.rest().to_vec();
            Packet::Publish(Publish { dup: flags & 0x08 != 0, qos, retain: flags & 1 != 0, topic, pid, props, payload })
        }
        4..=7 => {
            want_flags(if kind == 6 { 2 } else { 0 })?;
            let pid = r.u16()?;
            let code = if v5 && !r.done() { r.u8()? } else { 0 };
            let props = if v5 && !r.done() { Props::read(r)? } else { Props::default() };
            let a = Ack { pid, code, props };
            match kind {
                4 => Packet::PubAck(a),
                5 => Packet::PubRec(a),
                6 => Packet::PubRel(a),
                _ => Packet::PubComp(a),
            }
        }
        8 => {
            want_flags(2)?;
            let pid = r.u16()?;
            let props = props(r)?;
            let mut filters = Vec::new();
            while !r.done() {
                let f = r.string()?;
                let b = r.u8()?;
                let qos = b & 3;
                if qos == 3 {
                    return bad("subscription with QoS 3");
                }
                let o = if v5 {
                    SubOpts { qos, no_local: b & 0x04 != 0, retain_as_published: b & 0x08 != 0, retain_handling: (b >> 4) & 3 }
                } else {
                    SubOpts::qos(qos)
                };
                filters.push((f, o));
            }
            if filters.is_empty() {
                return bad("SUBSCRIBE without a topic filter");
            }
            Packet::Subscribe(Subscribe { pid, props, filters })
        }
        9 | 11 => {
            want_flags(0)?;
            let pid = r.u16()?;
            let props = props(r)?;
            let codes = r.rest().to_vec();
            let a = SubAck { pid, props, codes };
            if kind == 9 {
                Packet::SubAck(a)
            } else {
                Packet::UnsubAck(a)
            }
        }
        10 => {
            want_flags(2)?;
            let pid = r.u16()?;
            let props = props(r)?;
            let mut filters = Vec::new();
            while !r.done() {
                filters.push(r.string()?);
            }
            if filters.is_empty() {
                return bad("UNSUBSCRIBE without a topic filter");
            }
            Packet::Unsubscribe(Unsubscribe { pid, props, filters })
        }
        12 => {
            want_flags(0)?;
            Packet::PingReq
        }
        13 => {
            want_flags(0)?;
            Packet::PingResp
        }
        14 | 15 => {
            want_flags(0)?;
            if kind == 15 && !v5 {
                return bad("AUTH on MQTT 3.1.1");
            }
            let code = if v5 && !r.done() { r.u8()? } else { 0 };
            let props = if v5 && !r.done() { Props::read(r)? } else { Props::default() };
            let d = Disconnect { code, props };
            if kind == 14 {
                Packet::Disconnect(d)
            } else {
                Packet::Auth(d)
            }
        }
        _ => return bad(format!("packet type {kind}")),
    };
    // a 3.1.1 packet with bytes left over is broken; MQTT 5 parsing read everything above
    if !r.done() {
        return bad(format!("{} has {} bytes left over", packet.name(), r.b.len() - r.at));
    }
    Ok(packet)
}

// ---------- primitives ----------

/// The longest string or binary field MQTT carries (a two-byte length).
pub const MAX_STR: usize = u16::MAX as usize;

pub fn put_varint(out: &mut Vec<u8>, mut n: usize) {
    loop {
        let mut b = (n % 128) as u8;
        n /= 128;
        if n > 0 {
            b |= 0x80;
        }
        out.push(b);
        if n == 0 {
            break;
        }
    }
}

fn put_str(out: &mut Vec<u8>, s: &str) {
    put_bin(out, s.as_bytes());
}

fn put_bin(out: &mut Vec<u8>, b: &[u8]) {
    let n = b.len().min(u16::MAX as usize);
    out.extend_from_slice(&(n as u16).to_be_bytes());
    out.extend_from_slice(&b[..n]);
}

struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn done(&self) -> bool {
        self.at >= self.b.len()
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
        if self.b.len() - self.at < n {
            return bad("packet ends early");
        }
        let s = &self.b[self.at..self.at + n];
        self.at += n;
        Ok(s)
    }
    fn sub(&mut self, n: usize) -> Result<Reader<'a>, Error> {
        Ok(Reader { b: self.take(n)?, at: 0 })
    }
    fn rest(&mut self) -> &'a [u8] {
        let s = &self.b[self.at..];
        self.at = self.b.len();
        s
    }
    fn u8(&mut self) -> Result<u8, Error> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, Error> {
        let s = self.take(2)?;
        Ok(u16::from_be_bytes([s[0], s[1]]))
    }
    fn u32(&mut self) -> Result<u32, Error> {
        let s = self.take(4)?;
        Ok(u32::from_be_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn varint(&mut self) -> Result<usize, Error> {
        let mut n = 0usize;
        for i in 0..4 {
            let b = self.u8()?;
            n |= ((b & 0x7F) as usize) << (7 * i);
            if b & 0x80 == 0 {
                return Ok(n);
            }
        }
        bad("variable byte integer longer than 4 bytes")
    }
    fn bin(&mut self) -> Result<Vec<u8>, Error> {
        let n = self.u16()? as usize;
        Ok(self.take(n)?.to_vec())
    }
    fn string(&mut self) -> Result<String, Error> {
        let n = self.u16()? as usize;
        let s = self.take(n)?;
        String::from_utf8(s.to_vec()).map_err(|_| Error::Malformed("string is not UTF-8".into()))
    }
}

// ---------- reason codes ----------

/// A CONNACK return code (3.1.1) or reason code (5.0) in words, as the spec names it.
pub fn connack_reason(v: Version, code: u8) -> &'static str {
    match v {
        Version::V311 => match code {
            0 => "Connection Accepted",
            1 => "Unacceptable protocol version",
            2 => "Identifier rejected",
            3 => "Server unavailable",
            4 => "Bad user name or password",
            5 => "Not authorized",
            _ => "Unknown return code",
        },
        Version::V5 => reason(code),
    }
}

/// An MQTT 5 reason code in words.
pub fn reason(code: u8) -> &'static str {
    match code {
        0x00 => "Success",
        0x01 => "Granted QoS 1",
        0x02 => "Granted QoS 2",
        0x04 => "Disconnect with Will Message",
        0x10 => "No matching subscribers",
        0x11 => "No subscription existed",
        0x18 => "Continue authentication",
        0x19 => "Re-authenticate",
        0x80 => "Unspecified error",
        0x81 => "Malformed Packet",
        0x82 => "Protocol Error",
        0x83 => "Implementation specific error",
        0x84 => "Unsupported Protocol Version",
        0x85 => "Client Identifier not valid",
        0x86 => "Bad User Name or Password",
        0x87 => "Not authorized",
        0x88 => "Server unavailable",
        0x89 => "Server busy",
        0x8A => "Banned",
        0x8B => "Server shutting down",
        0x8C => "Bad authentication method",
        0x8D => "Keep Alive timeout",
        0x8E => "Session taken over",
        0x8F => "Topic Filter invalid",
        0x90 => "Topic Name invalid",
        0x91 => "Packet Identifier in use",
        0x92 => "Packet Identifier not found",
        0x93 => "Receive Maximum exceeded",
        0x94 => "Topic Alias invalid",
        0x95 => "Packet too large",
        0x96 => "Message rate too high",
        0x97 => "Quota exceeded",
        0x98 => "Administrative action",
        0x99 => "Payload format invalid",
        0x9A => "Retain not supported",
        0x9B => "QoS not supported",
        0x9C => "Use another server",
        0x9D => "Server moved",
        0x9E => "Shared Subscriptions not supported",
        0x9F => "Connection rate exceeded",
        0xA0 => "Maximum connect time",
        0xA1 => "Subscription Identifiers not supported",
        0xA2 => "Wildcard Subscriptions not supported",
        _ => "Unknown reason code",
    }
}

// ---------- topic names and filters ----------

/// Why a topic name can't be published to, or None when it can.
pub fn topic_name_problem(t: &str) -> Option<&'static str> {
    if t.is_empty() {
        Some("The topic is empty")
    } else if t.contains(['+', '#']) {
        Some("A topic you publish to can't hold the wildcards + or #")
    } else if t.contains('\0') {
        Some("The topic holds a null character")
    } else if t.len() > u16::MAX as usize {
        Some("The topic is longer than 65 535 bytes")
    } else {
        None
    }
}

/// Why a topic filter can't be subscribed to, or None when it can.
pub fn topic_filter_problem(f: &str) -> Option<String> {
    if f.is_empty() {
        return Some("The topic filter is empty".into());
    }
    if f.len() > MAX_STR {
        return Some("The topic filter is longer than 65 535 bytes".into());
    }
    if f.contains('\0') {
        return Some("The topic filter holds a null character".into());
    }
    let shared = f.strip_prefix("$share/");
    let body = match shared {
        Some(rest) => {
            let Some((group, filter)) = rest.split_once('/') else {
                return Some("A shared subscription reads $share/<group>/<filter>".into());
            };
            if group.is_empty() || group.contains(['+', '#']) {
                return Some("The share group name can't be empty or hold + or #".into());
            }
            if filter.is_empty() {
                return Some("A shared subscription reads $share/<group>/<filter>".into());
            }
            filter
        }
        None => f,
    };
    let levels: Vec<&str> = body.split('/').collect();
    for (i, l) in levels.iter().enumerate() {
        if l.contains('#') && (*l != "#" || i != levels.len() - 1) {
            return Some("# must be a whole level and the last one, e.g. sensors/#".into());
        }
        if l.contains('+') && *l != "+" {
            return Some("+ must be a whole level, e.g. sensors/+/temp".into());
        }
    }
    None
}

#[cfg(test)]
/// Whether a topic name matches a filter (the part after $share/<group>/ for a shared one).
/// Wildcards at the first level don't match topics that start with $ (MQTT 4.7.2).
pub fn matches(filter: &str, topic: &str) -> bool {
    let filter = match filter.strip_prefix("$share/") {
        Some(rest) => rest.split_once('/').map(|(_, f)| f).unwrap_or(""),
        None => filter,
    };
    if topic.starts_with('$') && (filter.starts_with('+') || filter.starts_with('#')) {
        return false;
    }
    let mut f = filter.split('/');
    let mut t = topic.split('/');
    loop {
        match (f.next(), t.next()) {
            (Some("#"), _) => return true,
            (Some("+"), Some(_)) => {}
            (Some(a), Some(b)) if a == b => {}
            (None, None) => return true,
            _ => return false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAX: usize = 1 << 20;

    fn round(p: Packet, v: Version) {
        let bytes = p.encode(v);
        let (back, used) = decode(&bytes, v, MAX).unwrap().unwrap();
        assert_eq!(used, bytes.len(), "{} took every byte", p.name());
        assert_eq!(back, p, "{} round trip on {}", p.name(), v.label());
        // every shorter prefix is "not all there yet", never an error
        for cut in 0..bytes.len() {
            assert_eq!(decode(&bytes[..cut], v, MAX).unwrap(), None, "{} cut at {cut}", p.name());
        }
    }

    fn full_props() -> Props {
        Props {
            payload_format: Some(1),
            message_expiry: Some(60),
            content_type: Some("application/json".into()),
            response_topic: Some("a/reply".into()),
            correlation: Some(vec![1, 2, 3]),
            subscription_ids: vec![7, 300],
            user: vec![("site".into(), "JKT-07".into()), ("site".into(), "dup keys allowed".into())],
            ..Default::default()
        }
    }

    #[test]
    fn varint_edges() {
        for (n, bytes) in [
            (0usize, vec![0x00]),
            (127, vec![0x7F]),
            (128, vec![0x80, 0x01]),
            (16_383, vec![0xFF, 0x7F]),
            (16_384, vec![0x80, 0x80, 0x01]),
            (2_097_151, vec![0xFF, 0xFF, 0x7F]),
            (2_097_152, vec![0x80, 0x80, 0x80, 0x01]),
            (268_435_455, vec![0xFF, 0xFF, 0xFF, 0x7F]),
        ] {
            let mut out = Vec::new();
            put_varint(&mut out, n);
            assert_eq!(out, bytes, "{n}");
            let mut r = Reader { b: &bytes, at: 0 };
            assert_eq!(r.varint().unwrap(), n);
        }
        let mut r = Reader { b: &[0xFF, 0xFF, 0xFF, 0xFF, 0x01], at: 0 };
        assert!(r.varint().is_err());
    }

    #[test]
    fn connect_bytes_match_the_spec() {
        // MQTT 3.1.1 spec 3.1.2.10 example: "MQTT", level 4, clean session, keep alive 10, client id "a"
        let c = Packet::Connect(Connect {
            version: Version::V311,
            client_id: "a".into(),
            clean_start: true,
            keep_alive: 10,
            username: None,
            password: None,
            will: None,
            props: Props::default(),
        });
        assert_eq!(c.encode(Version::V311), vec![0x10, 0x0D, 0x00, 0x04, b'M', b'Q', b'T', b'T', 0x04, 0x02, 0x00, 0x0A, 0x00, 0x01, b'a']);
        // the same on MQTT 5: level 5 and an empty property block
        let c5 = Packet::Connect(Connect { version: Version::V5, ..match c { Packet::Connect(c) => c, _ => unreachable!() } });
        assert_eq!(c5.encode(Version::V5), vec![0x10, 0x0E, 0x00, 0x04, b'M', b'Q', b'T', b'T', 0x05, 0x02, 0x00, 0x0A, 0x00, 0x00, 0x01, b'a']);
    }

    #[test]
    fn every_packet_round_trips() {
        for v in [Version::V311, Version::V5] {
            let p = |x: Props| if v == Version::V5 { x } else { Props::default() };
            round(
                Packet::Connect(Connect {
                    version: v,
                    client_id: "voidhttp-1".into(),
                    clean_start: false,
                    keep_alive: 60,
                    username: Some("ops".into()),
                    password: Some(b"s3cret".to_vec()),
                    will: Some(Will { topic: "atm/x/status".into(), payload: b"{\"state\":\"OFFLINE\"}".to_vec(), qos: 1, retain: true, props: p(Props { will_delay: Some(5), ..Default::default() }) }),
                    props: p(Props { session_expiry: Some(300), receive_max: Some(20), ..Default::default() }),
                }),
                v,
            );
            round(Packet::ConnAck(ConnAck { session_present: true, code: 0, props: p(Props { assigned_client_id: Some("auto-1".into()), max_qos: Some(1), server_keep_alive: Some(30), ..Default::default() }) }), v);
            round(Packet::Publish(Publish { dup: false, qos: 0, retain: true, topic: "a/b".into(), pid: None, props: p(full_props()), payload: b"hello".to_vec() }), v);
            round(Packet::Publish(Publish { dup: true, qos: 2, retain: false, topic: "a/b".into(), pid: Some(65535), props: Props::default(), payload: vec![0, 159, 146, 150] }), v);
            round(Packet::Publish(Publish { dup: false, qos: 1, retain: false, topic: "a".into(), pid: Some(1), props: Props::default(), payload: Vec::new() }), v);
            for make in [Packet::PubAck as fn(Ack) -> Packet, Packet::PubRec, Packet::PubRel, Packet::PubComp] {
                round(make(Ack::ok(42)), v);
                if v == Version::V5 {
                    round(make(Ack { pid: 9, code: 0x10, props: Props::default() }), v);
                    round(make(Ack { pid: 9, code: 0x87, props: Props { reason_string: Some("no".into()), ..Default::default() } }), v);
                }
            }
            round(
                Packet::Subscribe(Subscribe {
                    pid: 3,
                    props: p(Props { subscription_ids: vec![1], ..Default::default() }),
                    filters: vec![
                        ("atm/+/status".into(), SubOpts::qos(1)),
                        ("x/#".into(), if v == Version::V5 { SubOpts { qos: 2, no_local: true, retain_as_published: true, retain_handling: 2 } } else { SubOpts::qos(2) }),
                    ],
                }),
                v,
            );
            round(Packet::SubAck(SubAck { pid: 3, props: Props::default(), codes: vec![1, 0x80] }), v);
            round(Packet::Unsubscribe(Unsubscribe { pid: 4, props: Props::default(), filters: vec!["a".into(), "b/#".into()] }), v);
            round(Packet::UnsubAck(SubAck { pid: 4, props: Props::default(), codes: if v == Version::V5 { vec![0, 0x11] } else { vec![] } }), v);
            round(Packet::PingReq, v);
            round(Packet::PingResp, v);
            round(Packet::Disconnect(Disconnect { code: 0, props: Props::default() }), v);
            if v == Version::V5 {
                round(Packet::Disconnect(Disconnect { code: 0x8E, props: Props { reason_string: Some("taken over".into()), ..Default::default() } }), v);
                round(Packet::Auth(Disconnect { code: 0x18, props: Props { auth_method: Some("SCRAM-SHA-1".into()), auth_data: Some(vec![1]), ..Default::default() } }), v);
            }
        }
    }

    #[test]
    fn short_mqtt5_acks_mean_success() {
        // PUBACK with only a packet id (remaining length 2) is Success on MQTT 5
        let (p, _) = decode(&[0x40, 0x02, 0x00, 0x07], Version::V5, MAX).unwrap().unwrap();
        assert_eq!(p, Packet::PubAck(Ack::ok(7)));
        // a reason code without properties
        let (p, _) = decode(&[0x40, 0x03, 0x00, 0x07, 0x10], Version::V5, MAX).unwrap().unwrap();
        assert_eq!(p, Packet::PubAck(Ack { pid: 7, code: 0x10, props: Props::default() }));
        // an empty DISCONNECT is a normal one
        let (p, _) = decode(&[0xE0, 0x00], Version::V5, MAX).unwrap().unwrap();
        assert_eq!(p, Packet::Disconnect(Disconnect { code: 0, props: Props::default() }));
        // CONNACK with no property length at all (some brokers on refusal)
        let (p, _) = decode(&[0x20, 0x02, 0x00, 0x86], Version::V5, MAX).unwrap().unwrap();
        assert_eq!(p, Packet::ConnAck(ConnAck { session_present: false, code: 0x86, props: Props::default() }));
    }

    #[test]
    fn two_packets_back_to_back() {
        let mut bytes = Packet::PingResp.encode(Version::V5);
        bytes.extend(Packet::PubAck(Ack::ok(1)).encode(Version::V5));
        let (a, n) = decode(&bytes, Version::V5, MAX).unwrap().unwrap();
        assert_eq!(a, Packet::PingResp);
        let (b, m) = decode(&bytes[n..], Version::V5, MAX).unwrap().unwrap();
        assert_eq!(b, Packet::PubAck(Ack::ok(1)));
        assert_eq!(n + m, bytes.len());
    }

    #[test]
    fn broken_packets_are_errors() {
        let v = Version::V5;
        // QoS 3
        assert!(decode(&[0x36, 0x05, 0x00, 0x01, b'a', 0x00, 0x01], v, MAX).is_err());
        // PUBREL with flags 0
        assert!(decode(&[0x60, 0x02, 0x00, 0x01], v, MAX).is_err());
        // a string running past the end
        assert!(decode(&[0x30, 0x03, 0x00, 0x09, b'a'], v, MAX).is_err());
        // unknown property
        assert!(decode(&[0x30, 0x06, 0x00, 0x01, b'a', 0x02, 0x7E, 0x00], v, MAX).is_err());
        // a property twice
        assert!(decode(&[0x30, 0x08, 0x00, 0x01, b'a', 0x04, 0x01, 0x00, 0x01, 0x01], v, MAX).is_err());
        // invalid UTF-8 in a topic
        assert!(decode(&[0x30, 0x05, 0x00, 0x02, 0xC3, 0x28, 0x00], v, MAX).is_err());
        // packet type 0
        assert!(decode(&[0x00, 0x00], v, MAX).is_err());
        // too large
        assert_eq!(decode(&[0x30, 0xFF, 0x7F], v, 100), Err(Error::TooLarge(3 + 16_383)));
        // AUTH on 3.1.1
        assert!(decode(&[0xF0, 0x00], Version::V311, MAX).is_err());
        // 3.1.1 PUBACK with bytes left over
        assert!(decode(&[0x40, 0x03, 0x00, 0x01, 0x00], Version::V311, MAX).is_err());
    }

    #[test]
    fn filters_and_names() {
        for ok in ["a", "a/b", "+", "#", "a/+/c", "a/#", "+/+", "/", "$SYS/#", "$share/g/a/+", "$share/g/#"] {
            assert_eq!(topic_filter_problem(ok), None, "{ok}");
        }
        for no in ["", "a#", "a/#/b", "a+", "a/b+/c", "#/a", "$share/", "$share/g", "$share//a", "$share/g+/a", "$share/g/"] {
            assert!(topic_filter_problem(no).is_some(), "{no}");
        }
        assert_eq!(topic_name_problem("atm/1/status"), None);
        assert!(topic_name_problem("").is_some());
        assert!(topic_name_problem("a/+").is_some());
        assert!(topic_name_problem("a/#").is_some());
    }

    #[test]
    fn matching() {
        assert!(matches("atm/+/status", "atm/0142/status"));
        assert!(!matches("atm/+/status", "atm/0142/x/status"));
        assert!(matches("atm/#", "atm"));
        assert!(matches("atm/#", "atm/1/2/3"));
        assert!(matches("#", "a/b"));
        assert!(!matches("#", "$SYS/broker"));
        assert!(!matches("+/broker", "$SYS/broker"));
        assert!(matches("$SYS/#", "$SYS/broker/uptime"));
        assert!(matches("$share/ops/atm/+/alerts", "atm/0388/alerts"));
        assert!(matches("a/+", "a/"));
        assert!(!matches("a/b", "a/b/c"));
        assert!(matches("/+", "/x"));
    }

    #[test]
    fn reason_words() {
        assert_eq!(connack_reason(Version::V311, 4), "Bad user name or password");
        assert_eq!(connack_reason(Version::V5, 0x86), "Bad User Name or Password");
        assert_eq!(reason(0x8E), "Session taken over");
    }
}
