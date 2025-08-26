import numpy as np
import pandas as pd
from typing import Generator, Tuple, List
from statsmodels.tsa.statespace.sarimax import SARIMAX

def _safe_boxcox(y: np.ndarray, lam: float = 0.0) -> np.ndarray:
    return np.log1p(np.clip(y, a_min=0, a_max=None))

def _inv_boxcox(z: np.ndarray) -> np.ndarray:
    return np.expm1(z)

def _grid(
    p_range: List[int] = [0, 1, 2],
    d_range: List[int] = [0, 1],
    q_range: List[int] = [0, 1, 2],
    P_range: List[int] = [0, 1, 2],
    D_range: List[int] = [0, 1],
    Q_range: List[int] = [0, 1, 2],
) -> Generator[Tuple[int, int, int, int, int, int], None, None]:
    """
    Generator for (p,d,q,P,D,Q) combinations for SARIMA.

    Default ranges:
      p,d,q ∈ {0,1,2}
      P,D,Q ∈ {0,1,2}
    """
    for P in P_range:
        for D in D_range:
            for Q in Q_range:
                for p in p_range:
                    for d in d_range:
                        for q in q_range:
                            yield (p, d, q, P, D, Q)


def fit_forecast(df: pd.DataFrame, horizon: int = 14, seasonal_period: int = 7) -> pd.DataFrame:
    y = df.sort_values('date')['cases'].astype(float).values
    y_t = _safe_boxcox(y)

    best_aic = np.inf
    best_model = None

    for (p,d,q,P,D,Q) in _grid():
        try:
            model = SARIMAX(
                y_t,
                order=(p,d,q),
                seasonal_order=(P,D,Q,seasonal_period),
                trend='c',
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False)
            if model.aic < best_aic:
                best_aic = model.aic
                best_model = model
        except Exception:
            continue

    if best_model is None:
        last = y[-1] if len(y) else 0.0
        dates_fc = pd.date_range(df['date'].max() + pd.Timedelta(days=1), periods=horizon, freq='D')
        return pd.DataFrame({
            'date': dates_fc,
            'mean': np.full(horizon, last),
            'lower_80': np.full(horizon, max(0.0, last*0.8)),
            'upper_80': np.full(horizon, last*1.2),
            'lower_95': np.full(horizon, max(0.0, last*0.6)),
            'upper_95': np.full(horizon, last*1.4),
        })

    pred = best_model.get_forecast(steps=horizon)
    mean_t = pred.predicted_mean
    conf_int = pred.conf_int(alpha=0.2)
    conf_int95 = pred.conf_int(alpha=0.05)

    mean = _inv_boxcox(mean_t)
    lower_80 = _inv_boxcox(conf_int.iloc[:,0].values)
    upper_80 = _inv_boxcox(conf_int.iloc[:,1].values)
    lower_95 = _inv_boxcox(conf_int95.iloc[:,0].values)
    upper_95 = _inv_boxcox(conf_int95.iloc[:,1].values)

    dates_fc = pd.date_range(df['date'].max() + pd.Timedelta(days=1), periods=horizon, freq='D')

    return pd.DataFrame({
        'date': dates_fc,
        'mean': np.clip(mean, 0, None),
        'lower_80': np.clip(lower_80, 0, None),
        'upper_80': np.clip(upper_80, 0, None),
        'lower_95': np.clip(lower_95, 0, None),
        'upper_95': np.clip(upper_95, 0, None),
    })
