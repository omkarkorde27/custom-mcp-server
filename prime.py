#!/usr/bin/env python3
"""
Prime number finder with multiple approaches
"""

def is_prime(n):
    """
    Check if a number is prime using trial division.
    
    Args:
        n (int): Number to check
        
    Returns:
        bool: True if n is prime, False otherwise
    """
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    
    # Check odd divisors up to sqrt(n)
    for i in range(3, int(n**0.5) + 1, 2):
        if n % i == 0:
            return False
    return True


def find_primes_up_to(limit):
    """
    Find all prime numbers up to a given limit using the Sieve of Eratosthenes.
    
    Args:
        limit (int): Upper bound for finding primes
        
    Returns:
        list: List of prime numbers up to the limit
    """
    if limit < 2:
        return []
    
    # Initialize sieve
    sieve = [True] * (limit + 1)
    sieve[0] = sieve[1] = False
    
    # Sieve of Eratosthenes
    for i in range(2, int(limit**0.5) + 1):
        if sieve[i]:
            # Mark multiples of i as non-prime
            for j in range(i*i, limit + 1, i):
                sieve[j] = False
    
    # Collect prime numbers
    return [i for i in range(2, limit + 1) if sieve[i]]


def find_first_n_primes(n):
    """
    Find the first n prime numbers.
    
    Args:
        n (int): Number of primes to find
        
    Returns:
        list: List of first n prime numbers
    """
    if n <= 0:
        return []
    
    primes = []
    candidate = 2
    
    while len(primes) < n:
        if is_prime(candidate):
            primes.append(candidate)
        candidate += 1 if candidate == 2 else 2  # Skip even numbers after 2
    
    return primes


# Example tests
if __name__ == "__main__":
    print("Prime Number Finder Tests\n")
    
    # Test 1: Check if individual numbers are prime
    print("Test 1: Checking if individual numbers are prime")
    test_numbers = [1, 2, 3, 4, 5, 10, 11, 17, 20, 29, 100]
    for num in test_numbers:
        print(f"{num} is {'prime' if is_prime(num) else 'not prime'}")
    print()
    
    # Test 2: Find all primes up to 50
    print("Test 2: Prime numbers up to 50")
    primes_up_to_50 = find_primes_up_to(50)
    print(f"Primes up to 50: {primes_up_to_50}")
    print(f"Count: {len(primes_up_to_50)}")
    print()
    
    # Test 3: Find first 15 primes
    print("Test 3: First 15 prime numbers")
    first_15_primes = find_first_n_primes(15)
    print(f"First 15 primes: {first_15_primes}")
    print()
    
    # Test 4: Performance test - find larger primes
    print("Test 4: Performance test - finding primes up to 1000")
    import time
    start_time = time.time()
    primes_up_to_1000 = find_primes_up_to(1000)
    end_time = time.time()
    print(f"Found {len(primes_up_to_1000)} primes up to 1000")
    print(f"Time taken: {end_time - start_time:.4f} seconds")
    print(f"Last 10 primes: {primes_up_to_1000[-10:]}")
    print()
    
    # Test 5: Verify prime gaps
    print("Test 5: Prime gaps (differences between consecutive primes)")
    first_20_primes = find_first_n_primes(20)
    gaps = [first_20_primes[i+1] - first_20_primes[i] for i in range(len(first_20_primes)-1)]
    print(f"First 20 primes: {first_20_primes}")
    print(f"Gaps between them: {gaps}")
