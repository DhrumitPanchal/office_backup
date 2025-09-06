import axios from "axios";
import puppeteer from "puppeteer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const getData = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) return res.status(400).json({ error: "URL is required" });

    const extractCategory = (url) => {
      const regex = /brilliance\.com\/(.+\/.+)$/;
      const match = url.match(regex);
      return match ? match[1] : null;
    };

    const extractedCategory = extractCategory(url);
    if (!extractedCategory) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Step 1: Get list of products
    const products = await page.evaluate(async (path) => {
      const allData = [];
      let pager = 0;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await fetch(
          "https://worker.brilliance.com/api/v1/query/catalog-general",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              current_path: path,
              metals: [],
              pager: pager,
              price_range: [],
              ring_style: [],
              sort: "",
            }),
          }
        );

        const result = await response.json();
        allData.push(...result);
        if (result.length > 0) {
          pager++;
        } else {
          hasNextPage = false;
        }
      }

      return allData;
    }, extractedCategory);

    // Step 2: Fetch product details one by one (in browser context)
    const DetailedData = [];

    // console.log("Total products fetched:", products.length);
    // console.log(products.slice(0, 10)); // Log first 10 products for debugging

    for (const item of products.slice(0, 10)) {
      console.log("Fetching details for product:", item.alias);
      const detail = await page.evaluate(async (alias) => {
        try {
          const response = await fetch(
            "https://worker.brilliance.com/api/v1/product-data",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ url: alias }),
            }
          );

          const data = await response.json();
          const payload = {};

          Object.keys(data.product_images).map((key) => {
            const images = data.product_images[key].map((img) => {
              return `https://www.brilliance.com/${img}`;
            });

            payload[key] = images;
          });

          return { ...data, product_images: payload };
        } catch (err) {
          return null;
        }
      }, item.alias);

      if (detail) {
        // const product = detail.product;
        // console.log("Product fetched:", detail.title);
        DetailedData.push(detail);
      }
    }

    await browser.close();
    const flattenedRows = DetailedData.flatMap(flattenForShopifyExcel);

    const worksheet = XLSX.utils.json_to_sheet(flattenedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    // Define CSV file path
    const filePath = path.join(
      process.cwd(),
      "public",
      `${extractedCategory.trim().replaceAll(/\//g, "-")}.csv`
    );

    // Write the CSV file
    XLSX.writeFile(workbook, filePath, { bookType: "csv" });

    return res.status(200).json({
      total: DetailedData.length,
      message: "Data fetched successfully through Puppeteer",
      data: DetailedData,
    });
  } catch (error) {
    console.log("Error in Puppeteer getData:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const flattenForShopifyExcel = (product) => {
  const allVariants = [];

  const handle =
    product.sku ||
    product.nid ||
    product.title.toLowerCase().replace(/\s+/g, "-");
  const Vendor = "Brilliance";
  const title = product.title.replace("Moissanite", "Bortwide");
  const description =
    product.description?.replace("Moissanite", "Bortwide") || "";
  const productCategory = product.category || "jewellery";
  const images = product.product_images?.["720"] || [];
  const stock = 999; // You can replace with actual stock data if available

  const price = product.sell_price || product.list_price || "0";

  const sizeData = product.attributes?.options?.formSize || [];
  const colorData = product.attributes?.options?.formMetal || [];

  const hasSizes = sizeData.length > 0;
  const hasColors = colorData.length > 0;

  // Default flat row (no variants)
  if (!hasSizes && !hasColors) {
    allVariants.push({
      handle,
      Vendor,
      title,
      "Body (HTML)": description,
      Type: "jewellery",
      "Product Category": productCategory,
      Published: "TRUE",
      "Option1 Name": "",
      "Option1 Value": "",
      "Option2 Name": "",
      "Option2 Value": "",
      "Variant Grams": 0,
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": stock,
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": price,
      "Variant Compare At Price": price,
      "Variant Requires Shipping": true,
      "Variant Taxable": true,
      "Variant Barcode": "",
      "Image Src": images[0] || "",
      "Image Position": 1,
      "Image Alt Text": title,
      status: "active",
    });
    return allVariants;
  }

  // Variants loop
  for (let i = 0; i < (hasSizes ? sizeData.length : 1); i++) {
    const size = hasSizes ? sizeData[i] : {};
    const baseRow = {
      handle,
      Vendor,
      title,
      "Body (HTML)": description,
      Type: "jewellery",
      "Product Category": productCategory,
      Published: "TRUE",
      "Option1 Name": hasColors ? "color" : "",
      "Option1 Value": "",
      "Option2 Name": hasSizes ? "size" : "",
      "Option2 Value": hasSizes ? size.key : "",
      "Variant Grams": 0,
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": stock,
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": price,
      "Variant Compare At Price": price,
      "Variant Requires Shipping": true,
      "Variant Taxable": true,
      "Variant Barcode": "",
      "Image Src": images[0] || "",
      "Image Position": 1,
      "Image Alt Text": title,
      status: "active",
    };

    if (hasColors) {
      for (let j = 0; j < colorData.length; j++) {
        const color = colorData[j];
        const variantRow = { ...baseRow };
        variantRow["Option1 Value"] = color.key;
        allVariants.push(variantRow);
      }
    } else {
      allVariants.push(baseRow);
    }
  }

  return allVariants;
};

export default getData;
