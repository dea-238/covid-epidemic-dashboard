import pandas as pd

def analyze_intervention_impact(df: pd.DataFrame, effectiveness: float) -> dict:
    """
    Simulates the impact of an intervention by reducing the number of cases.
    This is a simplified model for educational purposes.
    """
    # Apply a rolling average to smooth the data before applying the effect
    smoothed_cases = df['cases'].rolling(window=7, min_periods=1, center=True).mean()
    
    # Simulate the case numbers with the intervention
    intervention_cases = (smoothed_cases * (1 - effectiveness)).clip(lower=0)
    
    return {
        "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
        "original_cases": smoothed_cases.tolist(), # Return smoothed cases for a better comparison
        "intervention_cases": intervention_cases.tolist(),
    }
