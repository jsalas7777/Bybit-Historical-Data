const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const apiKey = "";
const apiSecret = "";
const test_net = false;

const {
  InverseClient,
  LinearClient,
  InverseFuturesClient,
  SpotClientV3,
  UnifiedMarginClient,
  USDCOptionClient,
  USDCPerpetualClient,
  AccountAssetClient,
  CopyTradingClient,
  RestClientV5,
} = require("bybit-api");

// Setup readline to capture user input from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Define constants for start date, end date
const startDate = new Date("2024-06-01").getTime(); // Start date (milliseconds)
const endDate = new Date("2025-02-01").getTime(); // End date (milliseconds)

const getKlineData = async (
  symbol,
  startTimestamp,
  endTimestamp,
  interval = "60"
) => {
  try {
    const response = await axios.get("https://api.bybit.com/v5/market/kline", {
      params: {
        category: "inverse", // adjust if you are using a different category
        symbol: symbol,
        interval: interval, // interval in minutes (e.g., 60 for 1-hour)
        start: startTimestamp,
        end: endTimestamp,
      },
    });

    // Check if there is more data available and handle pagination
    if (response.data.result.list.length > 0) {
      return response.data.result.list;
    }
    return [];
  } catch (error) {
    console.error("Error fetching kline data:", error);
    return [];
  }
};

const downloadData = async (symbol) => {
  console.log("DOWNLOADING ", symbol);

  let startTimestamp = startDate;
  let allData = [];

  // Loop to fetch data in 120-hour chunks
  while (startTimestamp < endDate) {
    const endTimestamp = Math.min(
      startTimestamp + 120 * 60 * 60 * 1000,
      endDate
    ); // 120 hours in ms
    const klineData = await getKlineData(symbol, startTimestamp, endTimestamp);

    if (klineData.length > 0) {
      // Add new data and avoid duplicates based on timestamp
      klineData.forEach((item) => {
        if (!allData.some((existingItem) => existingItem[0] === item[0])) {
          allData.push(item);
        }
      });
    }

    // Update startTimestamp for the next iteration
    startTimestamp = endTimestamp;
  }

  // Sort data by timestamp (ascending)
  allData.sort((a, b) => a[0] - b[0]);

  return allData;
};

const saveDataToCSV = (data, symbol) => {
  // Ensure the "bybit_data" folder exists
  const folderPath = path.join(__dirname, "bybit_data");
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  const csvWriter = createCsvWriter({
    path: path.join(folderPath, `${symbol}_kline_data.csv`),
    header: [
      { id: "timestamp", title: "Timestamp" },
      { id: "open", title: "Open Price" },
      { id: "high", title: "High Price" },
      { id: "low", title: "Low Price" },
      { id: "close", title: "Close Price" },
      { id: "volume", title: "Volume" },
      { id: "turnover", title: "Turnover" },
    ],
  });

  const records = data.map((item) => ({
    timestamp: item[0], // Keep timestamp as milliseconds
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
    volume: item[5],
    turnover: item[6],
  }));

  csvWriter
    .writeRecords(records)
    .then(() => {
      console.log(`Data saved to bybit_data/${symbol}_kline_data.csv`);
    })
    .catch((err) => {
      console.error("Error writing CSV file:", err);
    });
};


const random = async () => {
    console.log("Random function called!");
  
    const bybit_client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      testnet: test_net,
    });
  
    const response = await bybit_client.getTickers({
      category: "linear",
    });
  
    // First filter to remove symbols containing "-"
    let list = response.result.list.filter((symbol) => {
      return !symbol.symbol.includes("-");
    });
  
    list = list.filter((symbol) => {
      return !symbol.symbol.toLowerCase().includes("perp");
    });
  
    // Shuffle the list
    list = list.sort(() => Math.random() - 0.5);
  
    // Limit the list to 24 items
    list = list.slice(0, 50);
  
    // Download data for each symbol in the randomized list
    for (let item of list) {
      let data = await downloadData(item.symbol);

      await saveDataToCSV(data, item.symbol);
    }
  };
  


// Prompt the user for the symbol to download
rl.question(
  'Enter the symbol to download data for (e.g., BTCUSD), or type "random" to call the random function: ',
  (input) => {
    if (input.toLowerCase() === "random") {
      random();
      rl.close();
    } else {
      downloadData(input)
        .then((data) => {
          saveDataToCSV(data, input);
          rl.close();
        })
        .catch((error) => {
          console.error("Error downloading data:", error);
          rl.close();
        });
    }
  }
);
