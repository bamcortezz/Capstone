import re

def validate_password(password):
    # Check password length
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    # Check for uppercase letters
    if not re.search(r'[A-Z]', password):
        return False, "Password must include at least one uppercase letter"
        
    # Check for lowercase letters
    if not re.search(r'[a-z]', password):
        return False, "Password must include at least one lowercase letter"
        
    # Check for numbers
    if not re.search(r'\d', password):
        return False, "Password must include at least one number"
        
    # Check for special characters
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must include at least one special character"
        
    return True, None
