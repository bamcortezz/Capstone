

TWITCH_SLANG_PATTERNS = {
    # ============================================
    # WIN/LOSS PATTERNS (Most Common)
    # ============================================
    
    'w_spam': {
        'pattern': r'\b(w{2,}|W{2,})\b',  # WW, WWW, WWWW, etc.
        'sentiment': 'positive',
        'confidence': 0.95,
        'description': 'W spam (win/positive outcome)'
    },
    
    'single_w': {
        'pattern': r'\b(w|W)\b',  # Single W
        'sentiment': 'positive',
        'confidence': 0.85,
        'description': 'Single W (win)'
    },
    
    'l_spam': {
        'pattern': r'\b(l{2,}|L{2,})\b',  # LL, LLL, LLLL, etc.
        'sentiment': 'negative',
        'confidence': 0.95,
        'description': 'L spam (loss/negative outcome)'
    },
    
    'single_l': {
        'pattern': r'\b(l|L)\b',  # Single L
        'sentiment': 'negative',
        'confidence': 0.85,
        'description': 'Single L (loss)'
    },
    
    # ============================================
    # EXCITEMENT/HYPE EMOTES (Positive)
    # ============================================
    
    'pog': {
        'pattern': r'\b(pog|poggers|pogchamp|pogu|pogU)\b',
        'sentiment': 'positive',
        'confidence': 0.90,
        'description': 'Pog emotes (excitement/amazing play)'
    },
    
    'kekw': {
        'pattern': r'\b(kekw|lul|lulw|omegalul|KEKW|OMEGALUL)\b',
        'sentiment': 'positive',
        'confidence': 0.88,
        'description': 'Laughing emotes (funny/entertaining)'
    },
    
    'lol_laughter': {
        'pattern': r'\b(lol|lmao|lmfao|rofl|rotfl|lel)\b',
        'sentiment': 'positive',
        'confidence': 0.85,
        'description': 'LOL/LMAO/LMFAO (laughter/funny)'
    },
    
    'lol_spam': {
        'pattern': r'\b(lo{3,}l+|lmao+|lmfao+|haha{3,}|jaja{3,})\b',
        'sentiment': 'positive',
        'confidence': 0.92,
        'description': 'LOL/LMAO spam (very funny - LOLOLOLOL, LMAOOOO, etc.)'
    },
    
    'appreciation': {
        'pattern': r'\b(clap|clappers|pog|gachiGASM)\b',
        'sentiment': 'positive',
        'confidence': 0.90,
        'description': 'Appreciation emotes'
    },
    
    '5head': {
        'pattern': r'\b(5head|bigbrain|galaxy\s*brain)\b',
        'sentiment': 'positive',
        'confidence': 0.88,
        'description': '5Head (smart play/good strategy)'
    },
    
    'based': {
        'pattern': r'\b(based|gigachad|sigma)\b',
        'sentiment': 'positive',
        'confidence': 0.85,
        'description': 'Based (agreement/respect)'
    },
    
    'hype': {
        'pattern': r'\b(hype|hyped|lets\s*go|lets\s*goooo)\b',
        'sentiment': 'positive',
        'confidence': 0.90,
        'description': 'Hype (excitement)'
    },
    
    # ============================================
    # SADNESS/DISAPPOINTMENT EMOTES (Negative)
    # ============================================
    
    'sadge': {
        'pattern': r'\b(sadge|pepehands|bibleThump|feelsbadman|FeelsBadMan)\b',
        'sentiment': 'negative',
        'confidence': 0.90,
        'description': 'Sad emotes (disappointment)'
    },
    
    'monka': {
        'pattern': r'\b(monkas|monkaS|monkaw|monkaW)\b',
        'sentiment': 'negative',
        'confidence': 0.85,
        'description': 'MonkaS (anxiety/fear/nervous)'
    },
    
    'copium': {
        'pattern': r'\b(copium|hopium)\b',
        'sentiment': 'negative',
        'confidence': 0.85,
        'description': 'Copium (coping/denial of bad situation)'
    },
    
    'mald': {
        'pattern': r'\b(malding|mald)\b',
        'sentiment': 'negative',
        'confidence': 0.90,
        'description': 'Malding (angry/frustrated)'
    },
    
    'cringe': {
        'pattern': r'\b(cringe|weirdchamp|WeirdChamp)\b',
        'sentiment': 'negative',
        'confidence': 0.90,
        'description': 'Cringe (awkward/embarrassing)'
    },
    
    'aggressive': {
        'pattern': r'\b(stfu|shut\s*up|gtfo|kys|uninstall)\b',
        'sentiment': 'negative',
        'confidence': 0.95,
        'description': 'Aggressive/toxic language (STFU, shut up, etc.)'
    },
    
    # ============================================
    # MOCKERY/MISTAKE EMOTES (Negative)
    # ============================================
    
    'pepega': {
        'pattern': r'\b(pepega|pepelaugh|PepeLaugh)\b',
        'sentiment': 'negative',
        'confidence': 0.80,
        'description': 'Pepega (mistake/dumb play/laughing at mistake)'
    },
    
    'ez': {
        'pattern': r'\b(ez|ezclap|EZ\s*Clap)\b',
        'sentiment': 'positive',  # Can be mocking, but generally positive/confident
        'confidence': 0.75,
        'description': 'EZ (easy - can be mocking but shows confidence)'
    },
    
    # ============================================
    # NEUTRAL/CONTEXT-DEPENDENT
    # ============================================
    
    'jebaited': {
        'pattern': r'\b(jebaited|baited)\b',
        'sentiment': 'neutral',
        'confidence': 0.75,
        'description': 'Jebaited (tricked/bamboozled)'
    },
    
    'kappa': {
        'pattern': r'\b(kappa|keepo)\b',
        'sentiment': 'neutral',
        'confidence': 0.70,
        'description': 'Kappa (sarcasm/joking)'
    },
    
    # ============================================
    # ADDITIONAL COMMON TWITCH EMOTES
    # ============================================
    
    'gg': {
        'pattern': r'\b(gg|ggwp|good\s*game)\b',
        'sentiment': 'positive',
        'confidence': 0.85,
        'description': 'GG (good game)'
    },
    
    'ff': {
        'pattern': r'\b(ff|forfeit)\b',
        'sentiment': 'negative',
        'confidence': 0.80,
        'description': 'FF (give up/surrender)'
    },
    
    'toxic': {
        'pattern': r'\b(toxic|griefing|inter|inting)\b',
        'sentiment': 'negative',
        'confidence': 0.90,
        'description': 'Toxic behavior indicators'
    },
    
    'clutch': {
        'pattern': r'\b(clutch|insane|nasty|clean)\b',
        'sentiment': 'positive',
        'confidence': 0.88,
        'description': 'Clutch play (amazing)'
    },
    
    'throw': {
        'pattern': r'\b(throw|throwing|threw)\b',
        'sentiment': 'negative',
        'confidence': 0.85,
        'description': 'Throw (losing on purpose or bad play)'
    },
    
    'diff': {
        'pattern': r'\b(\w+\s*diff)\b',  # "jg diff", "top diff", etc.
        'sentiment': 'neutral',  # Can be positive or negative depending on context
        'confidence': 0.70,
        'description': 'Diff (skill difference)'
    },
}

# You can add custom patterns here
CUSTOM_PATTERNS = {
    # Example:
    # 'my_custom_pattern': {
    #     'pattern': r'\b(custom|word|here)\b',
    #     'sentiment': 'positive',
    #     'confidence': 0.85,
    #     'description': 'My custom Twitch slang'
    # }
}

def get_all_patterns():
    """
    Returns all patterns (built-in + custom).
    This function is used by the sentiment analyzer.
    """
    all_patterns = TWITCH_SLANG_PATTERNS.copy()
    all_patterns.update(CUSTOM_PATTERNS)
    return all_patterns

def add_custom_pattern(pattern_id, pattern, sentiment, confidence, description):
    """
    Dynamically add a custom pattern at runtime.
    
    Args:
        pattern_id (str): Unique identifier for the pattern
        pattern (str): Regular expression pattern
        sentiment (str): 'positive', 'negative', or 'neutral'
        confidence (float): Confidence score between 0.0 and 1.0
        description (str): Human-readable description
    """
    CUSTOM_PATTERNS[pattern_id] = {
        'pattern': pattern,
        'sentiment': sentiment,
        'confidence': confidence,
        'description': description
    }

def remove_pattern(pattern_id):
    """Remove a pattern by its ID."""
    if pattern_id in CUSTOM_PATTERNS:
        del CUSTOM_PATTERNS[pattern_id]
    elif pattern_id in TWITCH_SLANG_PATTERNS:
        print(f"Warning: Cannot remove built-in pattern '{pattern_id}'. Use custom patterns instead.")
    else:
        print(f"Warning: Pattern '{pattern_id}' not found.")

def list_all_patterns():
    """Print all available patterns for debugging."""
    all_patterns = get_all_patterns()
    print("\n=== Twitch Slang Patterns ===\n")
    for pattern_id, data in all_patterns.items():
        print(f"ID: {pattern_id}")
        print(f"  Pattern: {data['pattern']}")
        print(f"  Sentiment: {data['sentiment']} (confidence: {data['confidence']})")
        print(f"  Description: {data['description']}")
        print()

# Example usage:
if __name__ == "__main__":
    # List all patterns
    list_all_patterns()
    
    # Add a custom pattern
    add_custom_pattern(
        pattern_id='new_emote',
        pattern=r'\b(newemote|newthing)\b',
        sentiment='positive',
        confidence=0.85,
        description='New custom emote'
    )
    
    print("\n=== After adding custom pattern ===")
    print(f"Total patterns: {len(get_all_patterns())}")

