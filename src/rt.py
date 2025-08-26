import numpy as np
import pandas as pd
from scipy.stats import gamma

def _discrete_gamma_pmf(k_max: int, mean_si: float, shape: float = 2.0) -> np.ndarray:
    scale = mean_si / shape
    s = np.arange(1, k_max+1)
    from scipy.stats import gamma as Gamma
    cdf = Gamma.cdf(s, a=shape, scale=scale)
    cdf_prev = Gamma.cdf(s-1, a=shape, scale=scale)
    pmf = np.maximum(cdf - cdf_prev, 0)
    if pmf.sum() > 0:
        pmf = pmf / pmf.sum()
    return pmf

def estimate_rt(df: pd.DataFrame, serial_interval: float = 4.0, window: int = 7) -> pd.DataFrame:
    df = df.sort_values('date').copy()
    df['cases'] = df['cases'].astype(float).fillna(0.0)
    df['I'] = df['cases'].rolling(window, min_periods=1, center=True).mean()

    k_max = max(1, int(5 * serial_interval))
    w = _discrete_gamma_pmf(k_max=k_max, mean_si=serial_interval)

    Rt = []
    for t in range(len(df)):
        if t == 0:
            Rt.append(np.nan)
            continue
        Ipast = df['I'].values[max(0, t-k_max):t]
        w_trunc = w[-len(Ipast):]
        denom = np.sum(w_trunc * Ipast[::-1])
        numer = df['I'].iloc[t]
        if denom <= 1e-8:
            Rt.append(np.nan)
            continue
        r = float(numer / denom)
        Rt.append(r)

    out = pd.DataFrame({
        'date': df['date'].values,
        'R_t': Rt,
    })
    return out
