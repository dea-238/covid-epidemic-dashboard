import numpy as np
import pandas as pd
from scipy.integrate import odeint

def seir_ode(y, t, N, beta, sigma, gamma):
    S, E, I, R = y
    dSdt = -beta * S * I / N
    dEdt = beta * S * I / N - sigma * E
    dIdt = sigma * E - gamma * I
    dRdt = gamma * I
    return dSdt, dEdt, dIdt, dRdt

def simulate_seir(N: int, E0: int, I0: int, R0: int, beta: float, sigma: float, gamma: float, days: int = 180):
    S0 = N - E0 - I0 - R0
    y0 = S0, E0, I0, R0
    t = np.arange(0, days+1)
    ret = odeint(seir_ode, y0, t, args=(N, beta, sigma, gamma))
    S, E, I, R = ret.T
    new_cases = np.maximum(0.0, np.diff(I, prepend=I[0]))
    dates = pd.to_datetime("today").normalize() + pd.to_timedelta(t, unit='D')
    return {
        'date': dates,
        'S': S,
        'E': E,
        'I': I,
        'R': R,
        'new_cases_proxy': new_cases,
        't': t,
    }
