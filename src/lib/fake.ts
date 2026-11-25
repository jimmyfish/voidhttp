// The faker-backed {{$random…}} values, English only. Loaded on first use, never at startup:
// the webview imports it as its own chunk (vars.ts), and scripts get the same code bundled by
// scripts/build-fake.mjs into src-tauri/src/script/fake.js, which QuickJS evaluates on first use.
import { faker } from "@faker-js/faker/locale/en";
import type { FakeName } from "./fakeNames";

/** loremflickr by topic, as Postman's category images; faker's own helper for it is deprecated. */
const topic = (t: string) => () => `https://loremflickr.com/640/480/${t}?lock=${faker.number.int({ max: 1e6 })}`;

const GEN: Record<FakeName, () => string | number | boolean | Date> = {
  $randomAlphaNumeric: () => faker.string.alphanumeric(1),
  $randomBoolean: () => faker.datatype.boolean(),
  $randomColor: () => faker.color.human(),
  $randomHexColor: () => faker.color.rgb(),
  $randomAbbreviation: () => faker.hacker.abbreviation(),

  $randomIP: () => faker.internet.ipv4(),
  $randomIPV6: () => faker.internet.ipv6(),
  $randomMACAddress: () => faker.internet.mac(),
  $randomPassword: () => faker.internet.password(),
  $randomLocale: () => faker.location.language().alpha2,
  $randomUserAgent: () => faker.internet.userAgent(),
  $randomProtocol: () => faker.internet.protocol(),
  $randomSemver: () => faker.system.semver(),

  $randomFirstName: () => faker.person.firstName(),
  $randomLastName: () => faker.person.lastName(),
  $randomFullName: () => faker.person.fullName(),
  $randomNamePrefix: () => faker.person.prefix(),
  $randomNameSuffix: () => faker.person.suffix(),

  $randomJobArea: () => faker.person.jobArea(),
  $randomJobDescriptor: () => faker.person.jobDescriptor(),
  $randomJobTitle: () => faker.person.jobTitle(),
  $randomJobType: () => faker.person.jobType(),

  $randomPhoneNumber: () => faker.phone.number(),
  $randomPhoneNumberExt: () => faker.helpers.replaceSymbols("##-###-###-####"),
  $randomCity: () => faker.location.city(),
  $randomStreetName: () => faker.location.street(),
  $randomStreetAddress: () => faker.location.streetAddress(),
  $randomCountry: () => faker.location.country(),
  $randomCountryCode: () => faker.location.countryCode(),
  $randomLatitude: () => faker.location.latitude(),
  $randomLongitude: () => faker.location.longitude(),

  $randomAvatarImage: () => faker.image.avatar(),
  $randomImageUrl: () => faker.image.url(),
  $randomAbstractImage: topic("abstract"),
  $randomAnimalsImage: topic("animals"),
  $randomBusinessImage: topic("business"),
  $randomCatsImage: topic("cats"),
  $randomCityImage: topic("city"),
  $randomFoodImage: topic("food"),
  $randomNightlifeImage: topic("nightlife"),
  $randomFashionImage: topic("fashion"),
  $randomPeopleImage: topic("people"),
  $randomNatureImage: topic("nature"),
  $randomSportsImage: topic("sports"),
  $randomTransportImage: topic("transport"),
  $randomImageDataUri: () => faker.image.dataUri(),

  $randomBankAccount: () => faker.finance.accountNumber(),
  $randomBankAccountName: () => faker.finance.accountName(),
  $randomCreditCardMask: () => faker.string.numeric(4),
  $randomBankAccountBic: () => faker.finance.bic(),
  $randomBankAccountIban: () => faker.finance.iban(),
  $randomTransactionType: () => faker.finance.transactionType(),
  $randomCurrencyCode: () => faker.finance.currencyCode(),
  $randomCurrencyName: () => faker.finance.currencyName(),
  $randomCurrencySymbol: () => faker.finance.currencySymbol(),
  $randomBitcoin: () => faker.finance.bitcoinAddress(),

  $randomCompanyName: () => faker.company.name(),
  $randomCompanySuffix: () => faker.helpers.arrayElement(["Inc", "and Sons", "LLC", "Group"]),
  $randomBs: () => faker.company.buzzPhrase(),
  $randomBsAdjective: () => faker.company.buzzAdjective(),
  $randomBsBuzz: () => faker.company.buzzVerb(),
  $randomBsNoun: () => faker.company.buzzNoun(),

  $randomCatchPhrase: () => faker.company.catchPhrase(),
  $randomCatchPhraseAdjective: () => faker.company.catchPhraseAdjective(),
  $randomCatchPhraseDescriptor: () => faker.company.catchPhraseDescriptor(),
  $randomCatchPhraseNoun: () => faker.company.catchPhraseNoun(),

  $randomDatabaseColumn: () => faker.database.column(),
  $randomDatabaseType: () => faker.database.type(),
  $randomDatabaseCollation: () => faker.database.collation(),
  $randomDatabaseEngine: () => faker.database.engine(),

  $randomDateFuture: () => faker.date.future(),
  $randomDatePast: () => faker.date.past(),
  $randomDateRecent: () => faker.date.recent(),
  $randomWeekday: () => faker.date.weekday(),
  $randomMonth: () => faker.date.month(),

  $randomDomainName: () => faker.internet.domainName(),
  $randomDomainSuffix: () => faker.internet.domainSuffix(),
  $randomDomainWord: () => faker.internet.domainWord(),
  $randomEmail: () => faker.internet.email(),
  $randomExampleEmail: () => faker.internet.exampleEmail(),
  $randomUserName: () => faker.internet.username(),
  $randomUrl: () => faker.internet.url(),

  $randomFileName: () => faker.system.fileName(),
  $randomFileType: () => faker.system.fileType(),
  $randomFileExt: () => faker.system.fileExt(),
  $randomCommonFileName: () => faker.system.commonFileName(),
  $randomCommonFileType: () => faker.system.commonFileType(),
  $randomCommonFileExt: () => faker.system.commonFileExt(),
  $randomFilePath: () => faker.system.filePath(),
  $randomDirectoryPath: () => faker.system.directoryPath(),
  $randomMimeType: () => faker.system.mimeType(),

  $randomPrice: () => faker.commerce.price(),
  $randomProduct: () => faker.commerce.product(),
  $randomProductAdjective: () => faker.commerce.productAdjective(),
  $randomProductMaterial: () => faker.commerce.productMaterial(),
  $randomProductName: () => faker.commerce.productName(),
  $randomDepartment: () => faker.commerce.department(),

  $randomNoun: () => faker.hacker.noun(),
  $randomVerb: () => faker.hacker.verb(),
  $randomIngverb: () => faker.hacker.ingverb(),
  $randomAdjective: () => faker.hacker.adjective(),
  $randomWord: () => faker.word.sample(),
  $randomWords: () => faker.word.words(),
  $randomPhrase: () => faker.hacker.phrase(),

  $randomLoremWord: () => faker.lorem.word(),
  $randomLoremWords: () => faker.lorem.words(),
  $randomLoremSentence: () => faker.lorem.sentence(),
  $randomLoremSentences: () => faker.lorem.sentences(),
  $randomLoremParagraph: () => faker.lorem.paragraph(),
  $randomLoremParagraphs: () => faker.lorem.paragraphs(),
  $randomLoremText: () => faker.lorem.text(),
  $randomLoremSlug: () => faker.lorem.slug(),
  $randomLoremLines: () => faker.lorem.lines(),
};

/** A fresh value for a {{$random…}} name, as text; undefined for a name faker does not cover. */
export function fake(name: string): string | undefined {
  const gen = Object.prototype.hasOwnProperty.call(GEN, name) ? GEN[name as FakeName] : undefined;
  return gen ? String(gen()) : undefined;
}
