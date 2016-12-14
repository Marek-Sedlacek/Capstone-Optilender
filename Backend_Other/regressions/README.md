In regressions.ipynb, I do the following:

I run the regression: 
    simple_return ~ age_in_months + borrower_rate + payment + C(term) + %s

Where %s is replaced iteratively by the other variables from Prosper's data. I generate the file simple_regressions.csv, which records the variable substituted, the pvalue, rsquared, confidence interval low (2.5%), and confidence interval high (97.5%).


In multi_regressions.ipynb, I investigate regressions of the form: 
    
    simple_return ~ age_in_months + borrower_rate + payment + C(term) + <additional terms>
   
where C() is used to evaluate a term categorically. The outputs are stored in the pickled pandas dataframe: best_aic_models.pkl. 

I'm not sure when (or if) I actually used the regressions_exploration.ipynb code. 


The file rmse_common_vars_regs.ipynb investigates the best regressions using common fields, evaluated by rmse. Generates the file: common_rmse_best.pkl


rmse_regs_compare.ipynb
I use the base variables: 
    'simple_return','age_in_months','borrower_rate','payment','amount_funded','term'

along with the best AIC variables from previous regression research.