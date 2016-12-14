"""
This module holds a class for making it easier to interact with the p2p_lending database.
@author: Daniel
"""

import sqlalchemy as sql
import pandas as pd

class DBConn(object):
    """Setup DB connection"""    
    
    def __init__(self,hostname='127.0.0.1', username='user', 
                 password='', database='p2p_lending', port=5432):
        self.hostname   = hostname
        self.username   = username
        self.password   = password
        self.database   = database
        self.port       = port
        
    def set_user(self, user):
        self.username = user
    
    def set_pass(self, password):
        self.password = password
        
    def connect(self):
        constring = 'postgresql://%s:%s@%s:%d/%s' %(self.username,
                                                    self.password,
                                                    self.hostname,
                                                    self.port,
                                                    self.database)
        self.eng = sql.create_engine(constring)
        return self.eng
        
    def close(self):
        self.eng.close()
        return 

