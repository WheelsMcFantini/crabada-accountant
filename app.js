require('dotenv').config()
const fetch = require('node-fetch')
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.AVAX_API_URL));
const fs = require('fs').promises
let dataStash = {}

const coingeckoCoinsAPI = "https://api.coingecko.com/api/v3/coins/"

async function retrieveTransactionData(address, startBlock = 0, endBlock = 99999999) {
    const erc20Url = `https://api.snowtrace.io/api?module=account&action=tokentx&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${process.env.API_KEY}`
    //console.log(erc20Url)
    const data = await fetch(erc20Url)
    const ERC20TxList = await data.json()
    return ERC20TxList
}

async function openFile(address) {
    try {
        const csvHeaders = 'timestamp,amount,token,fiatPrice,fiatTicker,gasUsed,gasPrice,from,to,hash'
        await fs.writeFile(`${address}-transactions.csv`, csvHeaders);
    } catch (error) {
        console.error(`Got an error trying to write to a file: ${error.message}`);
    }
}

async function addTransactionItem(txObject, address) {
    try {
        const csvLine = `\n${txObject['timestamp']},${txObject['value']},${txObject['symbol']},${txObject['fiatPrice']},${txObject['fiatTicker']},${txObject['gasUsed']},${txObject['gasPrice']},${txObject['from']},${txObject['to']},${txObject['hash']}`
        await fs.writeFile(`${address}-transactions.csv`, csvLine, { flag: 'a' });
    } catch (error) {
        console.error(`Got an error trying to write to a file: ${error.message}`);
        console.error(txObject)
    }
}

async function parseTransaction(tx) {
    //console.log(tx)
    txTime = new Date(tx['timeStamp'] * 1000)
    txTimeString = await txTime.toISOString()
    //console.log(`${txTimeString}, OUT, Token: ${tx['tokenSymbol']}, numTokens: ${web3.utils.fromWei(tx['value'], 'ether')}, Gas Used: ${tx['gasUsed']}, Gas Price: ${web3.utils.fromWei(tx['gasPrice'], 'gwei')}, From: ${tx['from']}, To: ${tx['to']}`)
    //console.log(`${txTimeString}, OUT, ${web3.utils.fromWei(tx['value'], 'ether')} ${tx['tokenSymbol']}, Gas Used: ${tx['gasUsed']}, Gas Price: ${web3.utils.fromWei(tx['gasPrice'], 'gwei')}, From: ${tx['from']}, To: ${tx['to']}`)
    value = (tx['tokenSymbol'].includes("USDC")) ? await web3.utils.fromWei(tx['value'], 'mwei') : await web3.utils.fromWei(tx['value'], 'ether')
    txObject = {
        timestamp: txTimeString,
        value: value,
        symbol: tx['tokenSymbol'],
        gasUsed: tx['gasUsed'],
        gasPrice: web3.utils.fromWei(tx['gasPrice'], 'gwei'),
        from: tx['from'],
        to: tx['to'],
        hash: tx['hash']
    }
    return txObject
    //return `${txTimeString}, OUT, ${web3.utils.fromWei(tx['value'], 'ether')} ${tx['tokenSymbol']}, Gas Used: ${tx['gasUsed']}, Gas Price: ${web3.utils.fromWei(tx['gasPrice'], 'gwei')}, From: ${tx['from']}, To: ${tx['to']}`
}

//wrapper for parseTransaction and writeTransaction
//open the file for writing, then
//for every tx in the given list, parse it and write it to the fs
async function parseTransactionList(ERC20TxList, address) {
    console.log(`There are ${ERC20TxList.length} transactions to process`)
    for (i = 0; i < ERC20TxList.length - 1; i++) {
        //console.log(ERC20TxList)
        parsedTx = await parseTransaction(ERC20TxList[i])
        //console.log(parsedTx)
        //add the fiat tx pairs to the parsed tx
        fiatData = await getFiatPrice(ERC20TxList[i], process.env.DESIRED_FIAT)
        Object.assign(parsedTx, fiatData)
        await addTransactionItem(parsedTx, address)
    }
}

//Converts 1 accounts worth of transactions into a CSV
async function crabadaAccountant(address) {
    console.log(`Running accountant for account ${address}`)
    txList = await retrieveTransactionData(address, process.env.START_BLOCK, process.env.END_BLOCK)
    await openFile(address)
    await parseTransactionList(txList['result'], address)
}

//START COINGECKO RELATED FUNCTIONS
//converts tx date format into day-month-year
async function convertDateForAPI(tx){
    var dateObj = new Date(tx['timeStamp'] * 1000);
    var month = dateObj.getUTCMonth() + 1; //months from 1-12
    var day = dateObj.getUTCDate();
    var year = dateObj.getUTCFullYear();

    convertedTxDate = `${day}-${month}-${year}`;

    return convertedTxDate
}

//replaces spaces in token names for URL use
async function convertTokenForAPI(tokenName){
    //console.log(`starting with ${tokenName}`)
    if (tokenName == "CRA"){
        tokenName = "Crabada"
    }
    lowercaseTokenName = tokenName.toLowerCase()
    convertedTokenName = lowercaseTokenName.replaceAll(' ', '-')
    //console.log(`ending with ${convertedTokenName}`)

    return convertedTokenName
}

//formats the URL for coingecko
async function formatURL(token, date){
    coingeckoCoinsAPIParams = `${token}/history?date=${date}`
    coingeckoURL = `${coingeckoCoinsAPI}${coingeckoCoinsAPIParams}`
    return coingeckoURL
}

//returns the json data from the coingecko query AKA callapiFN
async function getCoingeckoPrice(coingeckoURL){
    //console.log(coingeckoURL)
    //handle being rate limited
    //console.log(coingeckoURL)
    const response = await fetch(coingeckoURL)
    //const priceData = await response.json()
    return response
}

function getMillisToSleep (retryHeaderString) {
    let millisToSleep = Math.round(parseFloat(retryHeaderString) * 1000)
    if (isNaN(millisToSleep)) {
      millisToSleep = Math.max(0, new Date(retryHeaderString) - new Date())
    }
    return millisToSleep
  }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

//attempts to query CoinGecko, if it recieves an HTTP 429, backs off and retries
async function fetchAndRetryIfNecessary (coingeckoURL) {
    const response = await getCoingeckoPrice(coingeckoURL)
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      const millisToSleep = getMillisToSleep(retryAfter)
      await sleep(millisToSleep)
      return fetchAndRetryIfNecessary(coingeckoURL)
    }
    return response.json()
  }

//parses coingecko json output into the requested fiat price, checks for that currency first
async function parseCoingeckoPrice(coingeckoOutput, fiatTicker){
    console.log(coingeckoOutput)
    //optional chaining, read about
    if (coingeckoOutput.market_data?.current_price.hasOwnProperty(fiatTicker)) {
        console.log(`The API response does have ${fiatTicker} as a key`)
        if (typeof coingeckoOutput['market_data']['current_price'][fiatTicker] !== "undefined"){
            console.log(`The API response has a value for the key ${fiatTicker}`)
            return coingeckoOutput['market_data']['current_price'][fiatTicker]
        } else {
            console.log(`The API response has an undefined value for the key ${fiatTicker}`)
        }
    } else {
        console.log(`The API response does NOT have ${fiatTicker} as a key`)
    }
}

//primary coingecko function. given a tx and a required ticker, converts the date, formats the token name, retrieves the price and formats it
async function getFiatPrice(tx, fiatTicker){
    newDate = await convertDateForAPI(tx)
    convertedTokenName = await convertTokenForAPI(tx['tokenName'])
    url = await formatURL(convertedTokenName,newDate)
    dataKey = `${newDate}${tx['tokenSymbol']}`
    //check stash for data, if not there, go get it
    if (await checkStash(dataKey)){
        price = dataStash[`${dataKey}`]
        return {"fiatPrice": price, "fiatTicker": fiatTicker}
    } else {
        price = await fetchAndRetryIfNecessary(url)
        fiatPrice = await parseCoingeckoPrice(price, fiatTicker)
        await stashData(dataKey, fiatPrice)
        return {"fiatPrice": fiatPrice, "fiatTicker": fiatTicker}
    }
}

async function stashData(dataKey, price){
    if (dataStash.hasOwnProperty(dataKey)){
        //console.log(`${dataKey} already present in dataStash`)
    } else {
        dataStash[`${dataKey}`] = price
        //console.log(`${dataKey} value cached`)
        //console.log(dataStash)
    }
}

async function checkStash(dataKey){
    
    if (dataStash.hasOwnProperty(dataKey)){
        //console.log(`${dataKey} present in dataStash, retrieving from cache`)
        return true
    } else {
        //console.log(`${dataKey} not present in dataStash, retrieving from coingecko`)
        return false
    }
}
//END COINGECKO RELATED FUNCTIONS



async function main() {
    //if there's a single address, run once, if multiple, run once for each address
    var startTime = performance.now()
    const addresses = process.env.ADDRESSES.split(",")
    //console.log(addresses)
    //console.log(addresses.length)
    if (addresses.length == 0) {
        console.log("No addresses found in config file")
    } else if (addresses.length == 1) {
        console.log("One address found in config file")
        await crabadaAccountant(addresses[0])

    } else {
        console.log("Multiple addresses found in config file")
        for (let i = 0; i < addresses.length; i++) {
            await crabadaAccountant(addresses[i])
        }
    }
    var endTime = performance.now()
    console.log(`TX dowload took ${endTime - startTime} milliseconds`)
}

main()


module.exports = { retrieveTransactionData, openFile, addTransactionItem, parseTransaction, parseTransactionList }