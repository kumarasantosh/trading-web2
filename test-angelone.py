import yfinance as yf
ticker = yf.Ticker("ANGELONE.NS")
hist = ticker.history(period="5d")
print(hist)
