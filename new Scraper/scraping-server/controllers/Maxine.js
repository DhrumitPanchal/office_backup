import puppeteer from "puppeteer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const getProductIds = async (url) => {
  const productIds = new Set();

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  let currentUrl = url;

  while (true) {
    await page.goto(currentUrl, {
      waitUntil: "domcontentloaded",
      timeout: 600000,
    });

    // Extract product IDs on current page
    const ids = await page.$$eval("a.product-item[data-id]", (elements) =>
      elements.map((el) => el.getAttribute("data-id"))
    );
    ids.forEach((id) => productIds.add(id));

    console.log(`Extracted ${ids.length} IDs from ${currentUrl}`);

    // Check for next page link
    const nextPageHref = await page
      .$eval("span.pagination_next.pagination_item a", (el) =>
        el.getAttribute("href")
      )
      .catch(() => null);

    if (!nextPageHref) {
      console.log("No more pages.");
      break;
    }
    // break;
    // Update URL for next loop
    currentUrl = `https://www.maxinejewelry.com${nextPageHref}`;
  }

  await browser.close();
  console.log(`✅ Found ${productIds.size} unique product IDs`);
  return [...productIds];
};

export const Testing = async (req, res, url) => {
  try {
    let excelData = [];

    const browser = await puppeteer.launch({
      headless: false, // turn off headless
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    // set headless: true if you don’t want UI
    const page = await browser.newPage();

    const productIds = (await getProductIds(url)).slice(0, 5);
    const response = await fetch(
      "https://admin.innovelabs.com/isv/api/front/conversion-booster/product/getProductPage?qHandle=maxinejewelry123&qStoreId=1677908106396&ids=16065897813253051264461625,16064244199286867305151625&productHandles="
    );

    const data = await response.json();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    const productData = [];
    let productNumber = 1;
    for (const product of productIds) {
      const productId = product;

      const detailUrl = `https://www.maxinejewelry.com/leproxy/api/product/detail/highFrequencyData/query?productId=${productId}`;
      console.log(`Opening: ${productId} and product number: ${productNumber}`);

      await page.goto(detailUrl, {
        waitUntil: "domcontentloaded",
        timeout: 600000,
      });

      const bodyText = await page.evaluate(() => document.body.innerText);
      const json = JSON.parse(bodyText);

      const detailsUrl = `https://www.maxinejewelry.com/api/product/products.json?handle=${json.data.spu.uniqueKey}`;

      await page.goto(detailsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 600000,
      });
      const detailsText = await page.evaluate(() => document.body.innerText);
      const detailsJson = JSON.parse(detailsText);

      console.log(
        "tableBody ----------------",
        detailsJson.products[0].description
      );

      const colorUrl = `https://www.maxinejewelry.com/api/product-plugin/color-board/front/detail?productId=${productId}`;
      await page.goto(colorUrl, {
        waitUntil: "domcontentloaded",
        timeout: 600000,
      });
      const colorDataText = await page.evaluate(() => document.body.innerText);

      try {
        const colorJson = JSON.parse(colorDataText);
        const sizeData = [];

        const colordata =
          colorJson?.data?.colorBoardList?.flatMap((item) =>
            item?.attributeValueList?.map((a) => ({
              color: a?.attributeValue,
              image: a?.colorValue?.value,
              skuImage: a?.colorValue?.skuImgUrl,
              soldOut: a?.colorValue?.soldOut,
            }))
          ) || [];

        Object.values(json?.data?.sku.skuAttributeMap).forEach((item) => {
          if (item?.defaultName === "Size") {
            Object.values(item?.skuAttributeValueMap)?.forEach((size) => {
              sizeData.push(size?.defaultValue);
            });
          }
        });

        if (json?.data?.spu) {
          productData.push({
            ...json.data.spu,
            tableBody: detailsJson.products[0].description,
            sizes: sizeData,
            colors: colordata,
          });

          const allVariants = [];

          let flatData = {
            handle: json?.data?.spu.uniqueKey,
            Vendor: json?.data?.spu.storeId,
            title: json?.data?.spu.title.replace("Moissanite", "Bortwide"),
            "Body (HTML)": detailsJson.products[0].description.replace(
              "Moissanite",
              "Bortwide"
            ),
            Type: "jewellery",
            "Product Category": json?.data?.spu.customCategoryName,
            Published: "TRUE",
          };

          if (colordata.length > 0) {
            flatData[`Option1 Name`] = "color";
            flatData[`Option1 Value`] = colordata[0].color;
          }
          if (sizeData.length > 0) {
            flatData[`Option2 Name`] = "size";
            flatData[`Option2 Value`] = sizeData[0];
          }

          flatData[`Option3 Name`] = "";
          flatData[`Option4 Value`] = "";

          flatData = {
            ...flatData,
            "Variant Grams": 0,
            "Variant Inventory Tracker": "shopify",
            "Variant Inventory Qty": json?.data?.spu.stock,
            "Variant Inventory Policy": "deny",
            "Variant Fulfillment Service": "manual",
            "Variant Price": json?.data?.spu.productMaxPrice,
            "Variant Compare At Price": json?.data?.spu.productMaxPrice,
            "Variant Requires Shipping": true,
            "Variant Taxable": true,
            "Variant Barcode": "",
            "Image Src": json?.data?.spu.images[0],
            "Image Position": 1,
            "Image Alt Text": json?.data?.spu.title,
            status: "active",
          };

          allVariants.push(flatData);

          if (sizeData.length > 1) {
            for (let i = 1; i < sizeData.length; i++) {
              const newFlatData = { ...flatData };

              delete newFlatData[`Option1 Name`];
              delete newFlatData[`Option2 Name`];

              newFlatData[`Option2 Value`] = sizeData[i];
              allVariants.push(newFlatData);

              if (colordata.length > 1) {
                for (let j = 1; j < colordata.length; j++) {
                  const newFlatData2 = { ...newFlatData };
                  newFlatData2[`Option1 Value`] = colordata[j].color;
                  allVariants.push(newFlatData2);
                }
              }
            }
          }

          excelData.push(...allVariants);

          productNumber++;
        } else {
          console.warn(`No spu data for product ${productId}`);
        }
      } catch (e) {
        console.error(
          `Failed to parse JSON for product ${productId}`,
          e.message
        );
      }
    }

    await browser.close();

    console.log("excelData -------------------", excelData);

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const csvData = XLSX.utils.sheet_to_csv(worksheet);

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    // Save workbook to file
    const filePath = path.join("public", "products.csv");
    fs.writeFile(filePath, csvData, "utf8", function (err) {
      if (err) {
        console.log(
          "Some error occured - file either not saved or corrupted file saved."
        );
      } else {
        console.log("It's saved!");
      }
    });

    return res.status(200).json({
      message: "Success",
      total: productData.length,
      data: productData,
    });
  } catch (error) {
    console.error("Scraping failed:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
