# Figure reconciliation for W210 final project

# load the data
loan_data = read.csv('~/Dropbox/UCB_MIDS/W210/Project/final_prototype/data/loan_data_real.csv')
node_data = read.csv('~/Dropbox/UCB_MIDS/W210/Project/final_prototype/data/node_data_real.csv')
prosper_grade_data = read.csv('~/Dropbox/UCB_MIDS/W210/Project/final_prototype/data/prosper_grade_return_real.csv')

# define some variables
grades = c("AA", "A", "B", "C", "D")
attributes = c("months_employed", "total_inquiries", "bankcard_utilization", "all208")

# define some helper functions
Total.Return.Allocation = function(data, allocations, grades) {
  cum_return = 1
  for (year in 2010:2015) {
    curr_year_return = 0
    for (i in 1:length(allocations)) {
      curr_grade_allocation = allocations[i]
      curr_mean_return = mean(data$Actual_Return[data$Grade == grades[i] & data$Year == year])
      curr_year_return = curr_year_return + curr_grade_allocation * curr_mean_return
    }
    cum_return = cum_return * (1 + curr_year_return)
  }
  return(cum_return)
}

Opti.Portfolio.Return = function(node_data, grade_data, allocations, grades) {
  cum_opti_return = 1
  cum_benchmark_return = 1
  selected_node_ids = c()
  for (year in 2010:2015) {
    # compute estimated return and sd for benchmark portfolio
    benchmark_actual_return = 0
    benchmark_predicted_return = 0
    benchmark_predicted_sd = 0
    for (i in 1:length(allocations)) {
      curr_grade_allocation = allocations[i]
      
      curr_mean_predicted_return = mean(grade_data$Predict_Return[grade_data$Grade == grades[i] & grade_data$Year == year])
      curr_mean_actual_return = mean(grade_data$Actual_Return[grade_data$Grade == grades[i] & grade_data$Year == year])
      curr_mean_sd = mean(grade_data$Predict_Sd[grade_data$Grade == grades[i] & grade_data$Year == year])
      
      benchmark_actual_return = benchmark_actual_return + curr_grade_allocation * curr_mean_actual_return
      benchmark_predicted_return = benchmark_predicted_return + curr_grade_allocation * curr_mean_predicted_return
      benchmark_predicted_sd = benchmark_predicted_sd + curr_grade_allocation * curr_mean_sd
    }
    
    # select smart portfolio
    curr_year_node = node_data[node_data$Year == year, ]
    selected_nodes = curr_year_node[curr_year_node$Predict_Return >= benchmark_predicted_return & curr_year_node$Predict_Sd <= benchmark_predicted_sd, ]
    
    curr_year_return = mean(selected_nodes$Actual_Return)
    
    cum_benchmark_return = cum_benchmark_return * (1 + benchmark_actual_return)
    cum_opti_return = cum_opti_return * (1 + curr_year_return)
    selected_node_ids = c(selected_node_ids, selected_nodes$Node_ID)
  }
  
  # result[[1]] = benchmark cumulative return
  # result[[2]] = opti-lender cumulative return
  # result[[3]] = node_ids
  return(list(cum_benchmark_return, cum_opti_return, selected_node_ids))
}


# Summary Stats
Mean.Summary.Stats.Opti.Portfolio = function(loan_data, selected_node_ids, attributes) {
  selected_loans = loan_data[loan_data$Node_ID %in% selected_node_ids, ]
  result = data.frame(is_opti_stats=1)
  for (i in 1:length(attributes)) {
    result[attributes[i]] = mean(selected_loans[, attributes[i]], na.rm = TRUE)
  }
  return(result)
}

Mean.Summary.Stats.Benchmark.Portfolio = function(loan_data, attributes, allocations, grades) {
  result = data.frame(is_opti_stats=0)
  for (attribute in attributes) {
    attribute_value = 0
    for (i in 1:length(allocations)) {
      curr_grade_data = 
      attribute_value = attribute_value + allocations[i] * mean(loan_data[loan_data$Grade == grades[i], attribute], na.rm = TRUE)
    }
    result[attribute] = attribute_value
  }
  return(result)
}

# Validation 1 - 100% to D loans
weights = c(0, 0, 0, 0, 1)
result = Opti.Portfolio.Return(node_data, prosper_grade_data, weights, grades)

cat("Benchmark Cumulative = ", result[[1]])
cat("Opti-Lender Cumulative = ", result[[2]])

benchmark_stats = Mean.Summary.Stats.Benchmark.Portfolio(loan_data, attributes, weights, grades)
opti_stats = Mean.Summary.Stats.Opti.Portfolio(loan_data, result[[3]], attributes)
rbind(benchmark_stats, opti_stats)


# Validation 2 - 100% to C loans
weights = c(0, 0, 0, 1, 0)
result = Opti.Portfolio.Return(node_data, prosper_grade_data, weights, grades)

cat("Benchmark Cumulative = ", result[[1]])
cat("Opti-Lender Cumulative = ", result[[2]])

benchmark_stats = Mean.Summary.Stats.Benchmark.Portfolio(loan_data, attributes, weights, grades)
opti_stats = Mean.Summary.Stats.Opti.Portfolio(loan_data, result[[3]], attributes)
rbind(benchmark_stats, opti_stats)


# Validation 3 - 100% to AA loans
weights = c(1, 0, 0, 0, 0)
result = Opti.Portfolio.Return(node_data, prosper_grade_data, weights, grades)

cat("Benchmark Cumulative = ", result[[1]])
cat("Opti-Lender Cumulative = ", result[[2]])

benchmark_stats = Mean.Summary.Stats.Benchmark.Portfolio(loan_data, attributes, weights, grades)
opti_stats = Mean.Summary.Stats.Opti.Portfolio(loan_data, result[[3]], attributes)
rbind(benchmark_stats, opti_stats)

# Validation 4 - equally weighted portfolio (i.e. 20% to each grade)
weights = c(0.2, 0.2, 0.2, 0.2, 0.2)
result = Opti.Portfolio.Return(node_data, prosper_grade_data, weights, grades)

cat("Benchmark Cumulative = ", result[[1]])
cat("Opti-Lender Cumulative = ", result[[2]])

benchmark_stats = Mean.Summary.Stats.Benchmark.Portfolio(loan_data, attributes, weights, grades)
opti_stats = Mean.Summary.Stats.Opti.Portfolio(loan_data, result[[3]], attributes)
rbind(benchmark_stats, opti_stats)