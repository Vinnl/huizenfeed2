import { Browser, firefox } from "playwright-firefox";
import { Feed } from "feed";
import { writeFile, mkdir } from "fs/promises";

type FeedConfig = {
  url: string;
  title: string;
  entrySelector: string;
  titleSelector: string;
  linkSelector: string;
};

const feedConfigs: FeedConfig[] = [
  {
    url: "https://www.thijssenmakelaars.nl/aanbod/woningaanbod/UTRECHT/-400000/koop/2+kamers/",
    entrySelector: "li.aanbodEntry",
    titleSelector: ".addressInfo",
    linkSelector: "a.aanbodEntryLink",
    title: "Paul Thijssen makelaars - aanbod",
  },
  {
    url: "https://www.peekenpompe.nl/nl/woningaanbod?ignoreType[]=isBought#{%22view%22:%22grid%22,%22sort%22:%22addedDesc%22,%22address%22:%22%22,%22title%22:%22%22,%22salesRentals%22:%22sales%22,%22salesPriceMin%22:0,%22salesPriceMax%22:400000,%22devSalesPriceMin%22:0,%22devSalesPriceMax%22:9999999999,%22rentalsPriceMin%22:0,%22rentalsPriceMax%22:9999999999,%22devRentalsPriceMin%22:0,%22devRentalsPriceMax%22:9999999999,%22surfaceMin%22:0,%22surfaceMax%22:9999999999,%22unitsMin%22:0,%22unitsMax%22:9999999999,%22devSurfaceMin%22:0,%22devSurfaceMax%22:9999999999,%22plotSurfaceMin%22:0,%22plotSurfaceMax%22:9999999999,%22roomsMin%22:2,%22roomsMax%22:9999999999,%22bedroomsMin%22:0,%22bedroomsMax%22:9999999999,%22bathroomsMin%22:0,%22bathroomsMax%22:9999999999,%22city%22:[%22Utrecht%22],%22district%22:[],%22mainType%22:[],%22buildType%22:[],%22tag%22:[],%22country%22:[],%22state%22:[],%22listingsType%22:[],%22ignoreType%22:[%22isBought%22],%22categories%22:[],%22status%22:%22available%22,%22statusStrict%22:false,%22user%22:%22%22,%22branch%22:%22%22,%22archiveTime%22:15778463,%22page%22:1}",
    entrySelector: ".card-object",
    titleSelector: ".card-object-address",
    linkSelector: ".card-object-address",
    title: "Peek&Pompe makelaars - aanbod",
  },
  {
    url: "https://moib.nl/aanbod/",
    entrySelector: ".horizon",
    titleSelector: "h3",
    linkSelector: "a.overlay-link",
    title: "MOIB makelaars - aanbod",
  },
];

run();
let browser: Browser;
let browsePromise: Promise<Browser>;
async function getBrowser() {
  if (typeof browser === "undefined") {
    if (typeof browsePromise === "undefined") {
      browsePromise = firefox.launch();
    }
    browser = await browsePromise;
  }

  return browser;
}

async function run() {
  const feedsData = await Promise.all(feedConfigs.map(generateFeed));
  const combinedFeedData = combineFeedData(feedsData);
  const feed = await toFeed(combinedFeedData);
  await mkdir("public").catch(() => console.log("Directory `public` already exists; continuing."));
  await writeFile("public/feed.xml", feed, "utf-8");
  const browser = await getBrowser();
  await browser.close();
  console.log("Feed generated at public/feed.xml");
}

type FeedData = {
  title: string;
  url: string;
  elements: Array<{
    title?: string;
    contents: string;
    link?: string;
  }>;
};

async function generateFeed(config: FeedConfig): Promise<FeedData> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(config.url);
  const entriesElements = await page.$$(config.entrySelector);
  const entries: FeedData['elements'] = await Promise.all(entriesElements.map(async entryElement => {
    const titleElement = await entryElement.$(config.titleSelector);
    const linkElement = await entryElement.$(config.linkSelector);
    return {
      title: await titleElement?.textContent() ?? undefined,
      contents: await entryElement.innerHTML(),
      link: await linkElement?.getAttribute("href") ?? undefined,
    };
  }));

  return {
    title: config.title,
    url: config.url,
    elements: entries,
  };
}

function combineFeedData(feedsData: FeedData[]): FeedData {
  const elements = feedsData.reduce((soFar, feedData) => soFar.concat(feedData.elements), [] as FeedData['elements']);
  return {
    title: "Combined feed",
    url: "https://example.com",
    elements: elements,
  };
}

function toFeed(feedData: FeedData): string {
  const feed = new Feed({
    title: feedData.title,
    id: feedData.url,
    copyright: "",
  });
  feedData.elements.forEach((element, i) => {
    feed.addItem({
      title: element.title ?? i.toString(),
      link: element.link ?? feedData.url,
      content: element.contents,
      date: new Date(2021),
    });
  });

  return feed.atom1();
}
