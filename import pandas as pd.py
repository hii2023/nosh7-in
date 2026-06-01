import pandas as pd

# This creates a list of the last day of every month automatically
dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='ME')

for last_day in dates:
    first_day = last_day.replace(day=1)
    print(f"Downloading from {first_day.date()} to {last_day.date()}")
    # Here is where the bot would click the website