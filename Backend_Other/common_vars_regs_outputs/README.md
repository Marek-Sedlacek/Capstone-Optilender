The files rmse_common_vars[n].pkl, contain the results of linear regressions on common variables (variables present in 99% of the data). They contain pandas dataframes which can be accessed and inspected in the following manner: 

In [1]: import pandas as pd
In [2]: res1 = pd.read_pickle('common_vars_regs_outputs/rmse_common_vars1.pkl')

In [10]: res1.head(2)
Out[10]:
                                             aic      rmse  rsquared  \
(u'investment_typeid',)            206264.479886  0.533269  0.144147
(u'investment_type_description',)  207195.091318  0.534284  0.140694

                                                                              tables
(u'investment_typeid',)            [[[Dep. Variable:, simple_return,   R-squared:...
(u'investment_type_description',)  [[[Dep. Variable:, simple_return,   R-squared:...

The number n in the .pkl file indicates the number of variables which were used in the regressions, so for example rmse_common_vars1.pkl contains info for all 1-variable regressions. Note that, for the higher numbers (6,7) not all variable combinations may have been tried, due to the number of possibilies. 

The results are ordered by rmse (root-mean-squared-error) in ascending order. 

The tables column holds results from statsmodels regressions. To access the tables for the first record, do the following: 

In [20]: tbls = res1.tables[0]

In [21]: for t in tbls:
    ...:     print t.as_text()
    ...:
                            OLS Regression Results
==============================================================================
Dep. Variable:          simple_return   R-squared:                       0.144
Model:                            OLS   Adj. R-squared:                  0.144
Method:                 Least Squares   F-statistic:                 3.892e+04
Date:                Thu, 10 Nov 2016   Prob (F-statistic):               0.00
Time:                        00:40:43   Log-Likelihood:            -1.0313e+05
No. Observations:              231070   AIC:                         2.063e+05
Df Residuals:                  231068   BIC:                         2.063e+05
Df Model:                           1
Covariance Type:            nonrobust
==============================================================================
=====================================================================================
                        coef    std err          t      P>|t|      [95.0% Conf. Int.]
-------------------------------------------------------------------------------------
Intercept             1.1106      0.002    483.091      0.000         1.106     1.115
investment_typeid    -0.1848      0.001   -197.276      0.000        -0.187    -0.183
=====================================================================================
==============================================================================
Omnibus:                    39632.129   Durbin-Watson:                   1.240
Prob(Omnibus):                  0.000   Jarque-Bera (JB):             8583.980
Skew:                           0.011   Prob(JB):                         0.00
Kurtosis:                       2.056   Cond. No.                         8.24
==============================================================================


