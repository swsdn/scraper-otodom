const url = process.argv[2];
if (!url) {
    throw "Please provide a URL as the first argument";
}
console.log(url)

const puppeteer = require('puppeteer')
const fs = require('fs');

run(5)
    .then(console.log)
    .catch(console.error);

function run(pagesToScrape) {
    return new Promise(async(resolve, reject) => {
        try {
            const browser = await newBrowser();
            const page = await openNewPage(browser, url);
            let currentPage = 1;
            while (currentPage <= pagesToScrape) {
                let adUrls = await getAdUrls(page);
                console.log(`${fDate()} Scraping page ${currentPage} of ${adUrls.length} ads`)
                let adsOnPage = await Promise.all(adUrls.map(u => scrapAd(browser, u.url)))
                fs.writeFileSync(`./out/page${currentPage++}.json`, JSON.stringify(adsOnPage))
                const nextPageSelector = '#pagerForm > ul > li.pager-next > a'
                await page.waitForSelector(nextPageSelector)
                await page.click(nextPageSelector)
                await page.waitForSelector(nextPageSelector)
            }
            browser.close();
            return resolve('finished');
        } catch (e) {
            return reject(e);
        }
    })
}

async function openNewPage(browser, url) {
    const page = await browser.newPage();
    try {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.resourceType() === 'image') {
                request.abort();
            } else {
                request.continue();
            }
        });
        await page.goto(url);
        return page;
    } catch (e) {
        console.error(`${fDate()} Failed to open ${url} ${e}`)
        await page.close();
    }
}

function fDate() {
    let date = new Date();
    let datef = date.toDateString() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds();
    return datef;
}

async function scrapAd(browser, url) {
    const page = await openNewPage(browser, url)
    try {
        let result = await page.evaluate(() => {
            let price = document.querySelector('div.css-1vr19r7').innerText;
            let overview = Array.from(document.querySelector('section.section-overview > div > ul').childNodes)
                .map(c => c.innerText)
            let features = Array.from(document.querySelector('section.section-features > div > ul').childNodes)
                .map(c => c.innerText)
            let id = document.querySelector('div.css-kos6vh').innerText
            let name = document.querySelector('article > header > div > div > div > h1').innerText
            let location = Array.from(document.querySelector('article > section.section-breadcrumb > div > ul').childNodes).map(c => c.innerText).slice(2)
            return { id, name, location, price, overview, features, url: document.URL };
        });
        await page.close()
        console.log(`${fDate()} Scrapped ${url}`)
        return result
    } catch (e) {
        console.error(`${fDate()} Failed to scrap ${url} ${e}`)
        if (page) {
            await page.close()
        }
    }
}

async function getAdUrls(page) {
    return await page.evaluate(() => {
        let results = [];
        let items = document.querySelectorAll('div.offer-item-details > header > h3 > a');
        items.forEach((item) => {
            results.push({
                url: item.getAttribute('href'),
                text: item.innerText,
            });
        });
        return results;
    });
}

async function newBrowser() {
    return await puppeteer.launch({
        userDataDir: './data',
        headless: true,
        defaultViewport: null,
        args: [`--window-size=1280,1024`]
    });
}