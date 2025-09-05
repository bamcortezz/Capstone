import re

def validate_password(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must include at least one uppercase letter"
        
    if not re.search(r'[a-z]', password):
        return False, "Password must include at least one lowercase letter"
        
    if not re.search(r'\d', password):
        return False, "Password must include at least one number"
        
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must include at least one special character"
        
    return True, None
