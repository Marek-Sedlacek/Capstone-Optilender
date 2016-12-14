# -*- coding: utf-8 -*-
"""
Created on Sat Nov 12 14:06:17 2016

@author: Daniel
"""

#Build Automatic Investor
#	- inputs: 
#		amount of money, start time, amount per loan, distribution (number of loans) by prosper rating
#	- look at one or two weeks from start time

import logging
import numpy as np
import pandas as pd
import datetime as dt
from db_conn import DBConn

class PortfolioInvest(object):

    def __init__(self, invest_amt, startdate, dataset, dbconnection,
                 distribution={'AA':14.28, 'A':14.28, 'B':14.28,
                                      'C':14.28, 'D':14.28, 'E':14.28,
                                      'HR':14.28, 'CASH':0}):
        '''startdate format is YYYY-MM-DD, '''
        self.con          = dbconnection
        self.invest_amt   = invest_amt
        self.startdate    = startdate
        self.distribution = distribution
        self.dist_counts  = self.get_distribution_counts()
        self.dataset      = dataset
        self.listings     = self.get_listings()
        return

    #get listings from merged sql data
    def get_listings(self, days=3):
        """Get listings for one week. (dataset is
        train, dev, or test)"""
        enddate = dt.datetime.strptime(self.startdate, '%Y-%m-%d') + dt.timedelta(days=days)
        self.enddate = enddate
        self.edate = self.enddate.strftime('%Y-%m-%d')
        stmt = ("select * from merged_%s where origination_date >= " %(self.dataset) +
                "'%s' and origination_date < '%s' and term <> 12" %(self.startdate, self.edate))
        listings = pd.read_sql(stmt, self.con, index_col='loan_number')
        listings = listings[~(listings.listing_number.isnull())]
        return listings

    def extend_listings(self,days=2):
        new_start = self.edate
        self.enddate += dt.timedelta(days=days) 
        self.edate = self.enddate.strftime('%Y-%m-%d')
        stmt = ("select * from merged_%s where origination_date >= " %(self.dataset) +
                "'%s' and origination_date < '%s' and term <> 12" %(new_start, self.edate))
        new_listings = pd.read_sql(stmt, self.con, index_col='loan_number')
        new_listings = new_listings[~(new_listings.listing_number.isnull())]
        self.listings = self.listings.append(new_listings, ignore_index=True)
        return new_listings

    def get_distribution_counts(self, amt_per_loan=25):        
        """Return number of loans to choose per prosper rating type"""                                          
        dframe = pd.DataFrame(data=self.distribution.values(),
                            index=self.distribution.keys(),
                            columns=['allocation'])
                                                             
        num_loans = int(self.invest_amt)/int(amt_per_loan)
        if not num_loans > 0:
            raise 'please set correct invest_amt and amt_per_loan'
        cumulative_count = np.percentile(range(0, num_loans+1), 
                                 dframe.allocation.cumsum(),
                                 interpolation='nearest')
        dframe['cumulative_count'] = cumulative_count
        dframe['cnt'] = dframe.cumulative_count.diff()
        dframe.ix[0,'cnt'] = dframe.cumulative_count[0]
        dframe.sort_values(by='cnt', ascending=False, inplace=True)
        #get as close to exact proportion as possible (with whole numbers)
        if dframe.cnt.sum() > num_loans:
            for i in xrange(len(dframe)):
                dframe.ix[i,'cnt'] -= 1
                if dframe.cnt.sum() <= num_loans:
                    break
        if dframe.cnt.sum() < (num_loans - 1):
            for i in xrange(len(dframe)):
                dframe.ix[i,'cnt'] += 1
                if dframe.cnt.sum() >= num_loans:
                    break
        return dframe.cnt
        
    def choose_listings(self, amt_per_loan=25):
        '''Take a random sample of listings (start time is self.startdate).'''
        num_loans = self.invest_amt/float(amt_per_loan)
        el = list(self.listings.listing_number.sample(min(num_loans,len(self.listings))))
        while ((len(el) < len(self.listings)) and 
               (dt.datetime.now() > self.enddate)):
            dif = len(self.listings) - num_loans
            new_listings = self.extend_listings()
            el.extend(list(new_listings.listing_number.sample(min(dif,new_listings))))
        self.listing_choices_list = el
        return self.listing_choices_list
            
    def get_portfolio(self):
        self.portfolio = self.listings[
            self.listings.listing_number.isin(self.listing_choices_list)]
        return self.portfolio
            
    def get_simple_return(self):
        '''Must run get_portfolio first'''
        grp = self.portfolio.groupby('prosper_rating')
        self.simple_returns = grp[['principal_paid',
                            'interest_paid',
                            'amount_borrowed']].sum()
        self.simple_returns['simple_return'] = ((self.simple_returns.principal_paid + 
                                         self.simple_returns.interest_paid)  /
                                         self.simple_returns.amount_borrowed)
        self.simple_return = ((self.simple_returns.principal_paid.sum() +
                               self.simple_returns.interest_paid.sum()) /
                               self.simple_returns.amount_borrowed.sum())
        return self.simple_return

    def get_return(self):
        '''Must run get_portfolio first. Include late fees.'''
        grp = self.portfolio.groupby('prosper_rating')
        self.returns = grp[['principal_paid',
                            'interest_paid',
                            'late_fees_paid',
                            'amount_borrowed']].sum()
        self.returns['simple_return'] = ((self.returns.principal_paid + 
                                         self.returns.interest_paid  +
                                         self.returns.late_fees_paid) /
                                         self.returns.amount_borrowed)
        self.t_return = ((self.returns.principal_paid.sum() +
                               self.returns.interest_paid.sum()  +
                               self.returns.late_fees_paid.sum())        /
                               self.returns.amount_borrowed.sum())
        return self.t_return
    
    def get_simple_st_dev(self):
        returns = ((self.portfolio.principal_paid + 
                  self.portfolio.interest_paid) /
                  self.portfolio.amount_borrowed)
        return np.std(returns)
    
    def get_st_dev(self):
        returns = ((self.portfolio.principal_paid + 
                    self.portfolio.interest_paid  +
                    self.portfolio.late_fees_paid)/
                   self.portfolio.amount_borrowed)
        return np.std(returns)

    
class PortfolioAutoInvest(PortfolioInvest):
                    
    def choose_listings(self):
        """Choose listings according to self.distribution, and after startdate"""
        dist_c = self.dist_counts[self.dist_counts.index != 'CASH']
        cur_listings = self.listings
        self.listing_choices = pd.Series(data=[[] for _ in xrange(len(dist_c))],
                                    index=dist_c.index)
        self.listing_choices_list = []
        flag = 0
        while ((dist_c[dist_c.index!='CASH'].sum() > 0) and 
               (dt.datetime.now() > self.enddate)):
            #num_listings = len(self.listings)
            if flag:
                cur_listings = self.extend_listings()
            flag = 1
            #while num_listings == len(cur_listings):
            for cat in dist_c.index:
                #subset listings (get only AA or A or B... loans) 
                sublist = cur_listings[cur_listings.prosper_rating==cat]
                if len(sublist) == 0:
                    continue
                #random choice
                sz = min(int(dist_c[cat]), len(sublist))
                listing_nums = np.random.choice(sublist.listing_number, 
                                             size=sz, replace=False)
                listing_nums = [int(i) for i in listing_nums]
                self.listing_choices[cat].extend(listing_nums) 
                self.listing_choices_list.extend(list(listing_nums))
                dist_c[cat] -= sz
        return self.listing_choices

    
class PortfolioSmartAutoInvest(PortfolioInvest):

    def choose_listings(self, model):
        '''Uses model (i.e. statsmodel ols regression model) to predict/pick best listings.'''
        #run regressions on listings        
        #choose listings with best returns per rating (or should I do per int. rate)
        dist_c = self.dist_counts.copy()
        cur_listings = self.listings
        cur_listings = cur_listings.dropna(subset=model.params.index[1:])   #don't use na records
        self.listing_choices = pd.Series(data=[[] for _ in xrange(len(dist_c))],
                                    index=dist_c.index)
        self.listing_choices_list = []
        flag = 0
        while ((dist_c[dist_c.index!='CASH'].sum() > 0) and 
               (dt.datetime.now() > self.enddate)):
            if flag:
                cur_listings = self.extend_listings()
            flag = 1
            for cat in dist_c.index:
                if cat == 'CASH':
                    continue
                #subset listings (get only AA or A or B... loans) 
                sublist = cur_listings[cur_listings.prosper_rating==cat]
                if len(sublist) == 0:
                    continue
                if len(sublist) < dist_c[cat]:
                    #use all loans
                    listing_nums = [int(i) for i in sublist.listing_number]
                    dist_c[cat] -= len(sublist)                    
                    continue
                else:
                    sublist = sublist.sort_values(by='borrower_rate')
                    #predict                
                    #MAY NEED TO FORMAT SUBLIST TO FIT MODEL INPUT
                    pred = model.predict(sublist)
                    sublist['pred_simple_return'] = pred
                    #smart choice
                    #bin listings and get weights for bins
                    maxi = sublist.borrower_rate.max()
                    mini = sublist.borrower_rate.min()
                    maxi += .0001
                    STEPS = 10
                    bin_sides, step = np.linspace(mini, maxi, STEPS, retstep=True)
                    bin_weights = []
                    for i in xrange(len(bin_sides)-1):
                        wt = (len(sublist[((sublist.borrower_rate >= bin_sides[i]) & 
                                          (sublist.borrower_rate < bin_sides[i+1]))]) 
                             / float(len(sublist)))
                        bin_weights.append(wt)
                    if sum(bin_weights) != 1.0: 
                        wdiff = (1-sum(bin_weights))/float(len([i for i in bin_weights if i > 0]))
                        for i, val in enumerate(bin_weights):
                            if val > 0:
                                bin_weights[i] = val+wdiff
                    indices = range(len(bin_weights))
                    sz = int(dist_c[cat])
                    #how many times to sample from each bin
                    weighted_index_list = np.random.choice(indices, size=sz, p=bin_weights)
                    weighted_index_list.sort()
                    #sample top listings from each bin
                    listing_nums = []
                    for i in set(weighted_index_list):
                        in_rate_range = sublist[((sublist.borrower_rate >= bin_sides[i]) & 
                                                 (sublist.borrower_rate < bin_sides[i+1]))]
                        #get listing nums from highest pred return
                        in_rate_range.sort_values(by='pred_simple_return', ascending=False)
                        listing_nums.extend(
                           in_rate_range.listing_number[:list(weighted_index_list).count(i)])
                    listing_nums = [int(i) for i in listing_nums]
                    dist_c[cat] -= sz
                self.listing_choices[cat].extend(listing_nums) 
                self.listing_choices_list.extend(list(listing_nums))                       
        return self.listing_choices
    
#choose loans to invest in randomly by prosper rating and amount per loan
#get more loans if necessary

#evaluate performance on test (dev?) data
#is this in line with prosper's predictions? 

if __name__=='__main__':
    #setup logging
    logging.basicConfig(filename='auto_invest'+'.log')
    log = logging.getLogger()
    log.setLevel('INFO')
    
    #DB connection
    con = DBConn(username='',
                 password='')
    con = con.connect()
    log.info('db connected')
    
