import puppeteer from "puppeteer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const getProductLinks = async (url) => {
  const baseUrl = "https://louilyjewelry.com";
  const startUrl = url;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const allProductLinks = new Set();

  try {
    let nextPageUrl = startUrl;

    while (nextPageUrl) {
      console.log("🌐 Visiting:", nextPageUrl);
      await page.goto(nextPageUrl, { waitUntil: "networkidle2" });

      const { productLinks, nextPage } = await page.evaluate(() => {
        const links = [];
        const productAnchors = document.querySelectorAll(
          "a.product-card__link"
        );
        productAnchors.forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (href && href.includes("/products/")) {
            links.push(
              href.startsWith("http")
                ? href
                : `https://louilyjewelry.com${href}`
            );
          }
        });

        // Find the next page button (based on the given HTML structure)
        const nextAnchor = document.querySelector("span.next > a");
        const nextPageHref = nextAnchor
          ? nextAnchor.getAttribute("href")
          : null;
        const nextPageUrl = nextPageHref
          ? `https://louilyjewelry.com${nextPageHref}`
          : null;

        return { productLinks: links, nextPage: nextPageUrl };
      });

      productLinks.forEach((link) => allProductLinks.add(link));
      nextPageUrl = nextPage;
    }

    await browser.close();
    console.log(`✅ Total product links collected: ${allProductLinks.size}`);
    return Array.from(allProductLinks);
  } catch (error) {
    console.error("❌ Error:", error);
    await browser.close();
    throw error;
  }
};
export const Testing2 = async (req, res, url) => {
  let excelData = [];
  const max_size_variance = 0;

  try {
    const productIds = (await getProductLinks(url)).slice(0, 10);
    console.log("📦 Product list ready. Starting to scrape product details...");

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const allProductDetails = [];

    for (let i = 0; i < productIds.length; i++) {
      const product = productIds[i];
      let parts = productIds[i].split("/");
      parts = parts[parts.length - 1];

      try {
        // Try each slug one-by-one
        const url = `https://louilyjewelry.com/products/${parts}.json`;
        await page.goto(url, { waitUntil: "networkidle2" });

        const bodyText = await page.evaluate(() => document.body.innerText);

        const json = JSON.parse(bodyText).product;
        allProductDetails.push(json);

        let allVariants = [];

        let flatData = {
          handle: json?.handle,
          Vendor: json?.vendor,
          title: json?.title,
          "Body (HTML)": json.body_html,
          "Product Category": json?.product_type,
          Type: "jewellery",
          Tags: json?.tags,
          Published: "TRUE",
        };

        json?.variants?.slice(1).map((variant) => {
          const variantData = {
            ...flatData,
            "Option1 Name": "Color",
            "Option1 Value": "gold",
            "Option2 Name": "Size",
            "Option2 Value": variant?.option1,
            "Option3 Name": "Material",
            "Option3 Value": variant?.option3,
            "Variant SKU": variant.sku,
            "Variant Grams": variant?.grams,
            "Variant Inventory Tracker": "shopify",
            "Variant Inventory Qty": 5,
            "Variant Inventory Policy": "deny",
            "Variant Fulfillment Service": "manual",
            "Variant Price": variant?.price,
            "Variant Compare At Price": variant?.compare_at_price,
            "Variant Requires Shipping": true,
            "Variant Taxable": true,
            "Variant Barcode": variant?.barcode,
            "Image Src": json?.images.map((img) => {
              return img.variant_ids.includes(variant.id)
                ? img.src
                : json?.images[0].src;
            })[0],
            "Image Alt Text": json?.title,
          };

          return allVariants.push(variantData);
        });

        console.log("json data -------------------", json);

        flatData = {
          ...flatData,
          "Option1 Name": "Color",
          "Option1 Value": "gold",
          "Option2 Name": "Size",
          "Option2 Value": json?.variants[0]?.option1,
          "Option3 Name": "Material",
          "Option3 Value": json?.variants[0]?.option3,
          "Variant SKU": json?.variants[0]?.sku,
          "Variant Grams": json?.variants[0]?.grams,
          "Variant Inventory Tracker": "shopify",
          "Variant Inventory Qty": 5,
          "Variant Inventory Policy": "deny",
          "Variant Fulfillment Service": "manual",
          "Variant Price": json?.variants[0]?.price,
          "Variant Compare At Price": json?.variants[0]?.compare_at_price,
          "Variant Requires Shipping": true,
          "Variant Taxable": true,
          "Variant Barcode": json?.variants[0]?.barcode,
          "Image Src": json?.images.map((img) => {
            return img.variant_ids.includes(json?.variants[0]?.id)
              ? img.src
              : json?.images[0].src;
          })[0],
          "Image Alt Text": json?.title,
        };

        excelData.push(flatData);
        excelData.push(...allVariants);
        console.log(`✅ Scraped: ${i + 1}/${productIds.length} ->  ${url}`);
      } catch (innerError) {
        console.error(
          `❌ Error with product ${i + 1}: ${product.pageLink}`,
          innerError
        );
      }
    }

    await browser.close();

    console.log(
      `🎉 All product details scraped. Total: ${allProductDetails.length}`
    );

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
      success: true,
      totalProducts: allProductDetails.length,
      products: allProductDetails,
    });
  } catch (error) {
    console.error("❌ Error in test1 controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
