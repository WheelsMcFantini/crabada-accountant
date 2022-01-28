# Crabada Accountant
Crabada Accountant is a little tool I wrote to help me keep track of my Crabada mining teams. My goal was to collect transaction data from [Snowtrace](https://snowtrace.io) and enrich it with price data from [CoinGecko](https://coingecko.com). This requires a Snowtrace account, it's free to sign up and you get 5 API requests per second on the free plan which is more than enough, no payment information required! 

****


**Snowtrace Integration**

*This procedure tested on desktop*

Once you've created your Snowtrace account, log in and :
1. Hover over your username in the top right to open the dropdown, then select API Keys. 
2. Add a new key, name it whatever you want. 

**Environment setup**
*Requires node.js and yarn. Installation guides [here](https://nodejs.dev/learn/how-to-install-nodejs) and [here](https://classic.yarnpkg.com/en/docs/install)*
1. Download the code via git, or dowload the zip and extract it. 
2. Navigate into crabada-accountant-main (or whatever you saved it as) 
3. Make a copy of exampleEnv called `.env`.
4. Replace the placeholder addresses with the addresses you'd like to track
5. Replace `PUT_YOUR_SNOWTRACE_API_KEY_HERE` with your Snowtrace API Key
6. Update your desired Fiat currency if you'd like. I haven't tested all of them but any currency CoinGecko supports should work. (Tested usd, eur, krw, and gbp)
7. Adjust your start and end blocks to your liking. By default it will pull all transactions.

Once the above is complete, you can install it's dependencies with `yarn install` and then run the tool from the downloaded directory with `node app.js`!

Enjoy! 