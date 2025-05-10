def add_integers(a, b):
    """
    Add two integers and return the result.
    
    Args:
        a (int): First integer
        b (int): Second integer
    
    Returns:
        int: Sum of a and b
    """
    return a + b


# Example usage
if __name__ == "__main__":
    # Get input from user
    num1 = int(input("Enter first integer: "))
    num2 = int(input("Enter second integer: "))
    
    # Calculate sum
    result = add_integers(num1, num2)
    
    # Display result
    print(f"The sum of {num1} and {num2} is: {result}")
