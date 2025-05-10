#!/usr/bin/env python3
import sys
import time

print("Python script started!")
print(f"Arguments received: {sys.argv[1:]}")
print(f"Python version: {sys.version}")

# Demonstrate stderr output
print("This is an error message", file=sys.stderr)

# Show we can do some computation
result = sum(range(1, 101))
print(f"Sum of numbers 1-100: {result}")

# Show timestamp
from datetime import datetime
print(f"Current time: {datetime.now()}")

sys.exit(0)
