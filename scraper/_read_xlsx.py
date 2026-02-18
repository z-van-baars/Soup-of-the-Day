"""Dump ALL rows from full_list.xlsx."""
import openpyxl

wb = openpyxl.load_workbook('full_list.xlsx', data_only=True)
ws = wb['Sheet1']

rows = list(ws.iter_rows(values_only=True))
headers = rows[0]
data = rows[1:]
print(f"Headers: {headers}")
print(f"Total items: {len(data)}\n")
for i, row in enumerate(data):
    print(f"{i+1:3d}. {row}")
