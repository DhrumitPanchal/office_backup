import axios from "axios";
import puppeteer from "puppeteer";

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
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Use fetch inside the browser context

    const data = await page.evaluate(async (path) => {
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
          // Assuming 24 items per page
        } else {
          hasNextPage = false;
        }
      }

      return allData;
    }, extractedCategory);

    await browser.close();

    const DetailedData = [];

    // const detailData = await Promise.all(
    //   data.map(async (item) => {
    //     const res = await fetch(
    //       "https://worker.brilliance.com/api/v1/product-data",
    //       {
    //         method: "POST",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           url: item.alias,
    //         }),
    //       }
    //     );

    //     const detail = await res.json();

    //     if (detail && detail.product) {
    //       const product = detail.product;
    //       DetailedData.push({
    //         id: product.id,
    //         name: product.name,
    //         price: product.price,
    //         image: product.image,
    //         description: product.description,
    //         category: extractedCategory,
    //         url: item.alias,
    //       });
    //     }
    //   })
    // );

    const detailData = await axios.post(
      "https://worker.brilliance.com/api/v1/product-data",
      {
        url: "wedding-rings/petite-halo-matching-band-yellow-gold",
      }
    );

    // const detailDatas = await detailData.json();

    console.log("detailData:", detailData);

    return res.status(200).json({
      //   total: DetailedData.length,
      message: "Data fetched successfully through Puppeteer",
      data: detailData,
    });
  } catch (error) {
    console.log("Error in Puppeteer getData:", error);
    console.error("Error in Puppeteer getData:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export default getData;
