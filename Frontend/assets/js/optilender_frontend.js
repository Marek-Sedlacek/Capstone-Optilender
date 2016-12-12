
/**
 * Created by myan on 11/18/16.
 */

function storeLoanDataReal() {
    if (window.loan_data_real == null) {
        var loan_data_real = [];
        readLoanDataReal(loan_data_real);
        window.loan_data_real = loan_data_real;
    }
}

function analyze(has_data) {
    // myan: this is the main entry point of interaction
    if (has_data){
        validateAndStoreInput();

        updateSelections();

        prosperSamplePortfolioReturns();

        modelPortfolioReturns();

        summarizeKeyStatistics();
    }
    updateAnalysisPage(has_data);
}

function mean(list_input) {
    var sum = 0;
    for (i = 0; i < list_input.length; i++) {
        sum = sum + list_input[i];
    }
    return sum / i;
}

function weightedAverage(obj_weights, obj_values) {
    // obj_weights:     {field1:weight1, field2:weight2, ...}
    // obj_values:      {field1:value1, field2:value2, ...}
    // It is required that obj_weights and obj_values have the same fields.

    var weight_sum = 0;
    for (var field in obj_weights) {
        weight_sum = weight_sum + obj_weights[field] * obj_values[field];
    }
    return weight_sum;
}

function weightedAverageStatistics(allocations, data_year_grade, attribute) {
    var grade_attribute_data = {};
    for (var grade in allocations) {
        var curr_grade_data = [];
        for (var year in data_year_grade) {
            for (i = 0; i < data_year_grade[year][grade].length; i++) {
                curr_grade_data.push(data_year_grade[year][grade][i][attribute]);
            }
        }
        grade_attribute_data[grade] = mean(curr_grade_data);
    }
    return weightedAverage(allocations, grade_attribute_data);
}

function meanStatistics(loans, attribute) {
    var attribute_values = [];
    for (idx in loans) {
        attribute_values.push(loans[idx][attribute]);
    }
    return mean(attribute_values);
}

function getSelectedLoans(loans, selected_nodes) {
    var selected_loans = [];
    for (i = 0; i < loans.length; i++) {
        if (selected_nodes.indexOf(loans[i]["Node_ID"]) > -1) {
            selected_loans.push(loans[i]);
        }
    }
    return selected_loans;
}
function summarizeKeyStatistics() {
    function getAllocations() {
        var result = {};
        result["AA"] = +sessionStorage.getItem("allocation_aa");
        result["A"] = +sessionStorage.getItem("allocation_a");
        result["B"] = +sessionStorage.getItem("allocation_b");
        result["C"] = +sessionStorage.getItem("allocation_c");
        result["D"] = +sessionStorage.getItem("allocation_d");
        return result;
    }

    var allocations = getAllocations();

    var loan_data = window.loan_data_real;
    var loan_data_year_grade = makeLoanDataYearGrade(loan_data);
    var selected_nodes_year = JSON.parse(sessionStorage.getItem("selected_nodes_year"));
    var list_attributes = JSON.parse(sessionStorage.getItem("list_attributes"));

    function computeSamplePortfolioStats(data, allocations, attributes) {
        var result = {};
        for (idx in attributes) {
            result[attributes[idx]] = weightedAverageStatistics(allocations, data, attributes[idx]);
        }
        return result;
    }

    var sample_stats = computeSamplePortfolioStats(loan_data_year_grade, allocations, list_attributes);
    persistJsonToSessionStorage("table_sample_stats", sample_stats);

    function computeOptimalPortfolioStats() {
        var all_selected_nodes = [];
        for (var year in selected_nodes_year) {
            if (year != "all_years") {
                all_selected_nodes = all_selected_nodes.concat(selected_nodes_year[year]["selected_nodes"]);
            }
        }

        var selected_loans = getSelectedLoans(loan_data, all_selected_nodes);

        var result = {};
        for (idx in list_attributes) {
            result[list_attributes[idx]] = meanStatistics(selected_loans, list_attributes[idx]);
        }
        return result;
    }

    var optimal_stats = computeOptimalPortfolioStats();
    persistJsonToSessionStorage("table_optimal_stats", optimal_stats);
}

function modelPortfolioReturns() {
    //TODO: think about a better name than sample_portfolio_returns?
    var sample_portfolio_returns = JSON.parse(sessionStorage.getItem("sample_portfolio_returns"));

    function calculateSamplePortfolioStatistics(sample_input) {
        var results = {};
        for (i = 0; i < sample_input.length; i++) {
            var curr_year = sample_input[i]["year"];
            if (curr_year in results) {
                results[curr_year]["annual_average_return"] = results[curr_year]["annual_average_return"] + sample_input[i]["predict_annual_return"];
                results[curr_year]["annual_average_sd"] = results[curr_year]["annual_average_sd"] + sample_input[i]["predict_annual_sd"];
                results[curr_year]["num_of_months"] = results[curr_year]["num_of_months"] + 1;
            }
            else {
                results[curr_year] = {
                    "annual_average_return": sample_input[i]["predict_annual_return"],
                    "annual_average_sd":sample_input[i]["predict_annual_sd"],
                    "num_of_months": 1};
            }
        }

        for (k in results) {
            results[k]["annual_average_return"] = results[k]["annual_average_return"] / results[k]["num_of_months"];
            results[k]["annual_average_sd"] = results[k]["annual_average_sd"] / results[k]["num_of_months"];
        }
        return results;
    }

    var average_sample_return_sd = calculateSamplePortfolioStatistics(sample_portfolio_returns);

    function selectNodes() {
        // output: {"year1":{"selected_nodes":[node_id1, node_id2, ...], "annual_return":, "annual_sd":}, ...}
        var nodes = JSON.parse(sessionStorage.getItem("node_data_real"));
        var selected_nodes_year = {};
        var all_years = [];
        for (year in average_sample_return_sd) {
            var sample_return = average_sample_return_sd[year]["annual_average_return"];
            var sample_sd = average_sample_return_sd[year]["annual_average_sd"];
            var curr_year_nodes = nodes[year];
            var curr_year_selected_node_ids = [];

            var curr_node_return = 0;
            var curr_node_sd = 0;

            // myan: this is code to do weighted average
            var total_weights = 0;

            for (i = 0; i < curr_year_nodes.length; i++) {
                if (curr_year_nodes[i]["Predict_Return"] >= sample_return && curr_year_nodes[i]["Predict_Sd"] <= sample_sd) {

                    // myan: change curr_weights to 1 woud do simple arithmetic average
                    var curr_weights = curr_year_nodes[i]["Amount_Borrowed"];
                    curr_node_return = curr_node_return + curr_year_nodes[i]["Actual_Return"] * curr_weights;
                    curr_node_sd = curr_node_sd + curr_year_nodes[i]["Predict_Sd"] * curr_weights;
                    total_weights = total_weights + curr_weights;
                    curr_year_selected_node_ids.push(curr_year_nodes[i]["Node_ID"]);
                }
            }
            selected_nodes_year[year] = {
                "selected_nodes": curr_year_selected_node_ids,
                "annual_return": curr_node_return / total_weights,
                "annual_sd": curr_node_sd / total_weights};
            all_years.push(year);
        }
        all_years.sort();
        selected_nodes_year["all_years"] = all_years;
        persistJsonToSessionStorage("selected_nodes_year", selected_nodes_year);
        return selected_nodes_year;
    }

    var selectedNodes = selectNodes();

    function constructOptimalPortfolio() {
        // [{"year", "month", "annual_return", "annual_sd", "cumulative_return"}, ...]
        var results = [];
        for (i = 0; i < selectedNodes["all_years"].length; i++) {
            var curr_year = +selectedNodes["all_years"][i];
            var curr_year_annual_return = selectedNodes[curr_year]["annual_return"];
            var curr_year_annual_sd = selectedNodes[curr_year]["annual_sd"];
            var monthly_return = monthlyReturn(curr_year_annual_return);
            var cum_return;
            for (j = 1; j < 13; j++) {
                if (results.length < 1) {
                    cum_return = 1;
                }
                else {
                    cum_return = results[results.length - 1]["cumulative_return"] * (1 + monthly_return);
                }
                results.push({
                    "year": curr_year,
                    "month": j,
                    "annual_return": curr_year_annual_return,
                    "annual_sd": curr_year_annual_sd,
                    "cumulative_return": cum_return
                });
            }
        }
        return results;
    }

    var optimal_portfolio_returns = constructOptimalPortfolio();
    persistJsonToSessionStorage("optimal_portfolio_returns", optimal_portfolio_returns);
    // [{"year", "month", "annual_return", "annual_sd", "cumulative_return"}, ...]
    // key = optimal_portfolio_returns
}

function monthlyReturn(annual_return) {
    return Math.pow(1 + annual_return, 1 / 12.0) - 1.0;
}
function prosperSamplePortfolioReturns() {
    var prosper_grade_return_real = JSON.parse(sessionStorage.getItem("prosper_grade_return_real"));

    var list_weightings_by_grade = [];
    var list_returns_by_grade = [];

    function portfolioWeightAndReturns(grade_return_data, grade_upper) {
        var key = "allocation_" + grade_upper.toLowerCase();

        function filterReturnsByGrade(data, grade_upper) {
            var result = [];
            for (i = 0; i < data.length; i++) {
                if (data[i]["Grade"] == grade_upper) {
                    result.push(data[i]);
                }
            }
            return result;
        }

        if (JSON.parse(sessionStorage.getItem(key)) > 0) {
            list_weightings_by_grade.push(JSON.parse(sessionStorage.getItem(key)));
            list_returns_by_grade.push(filterReturnsByGrade(grade_return_data, grade_upper));
        }
    }

    portfolioWeightAndReturns(prosper_grade_return_real, "AA");
    portfolioWeightAndReturns(prosper_grade_return_real, "A");
    portfolioWeightAndReturns(prosper_grade_return_real, "B");
    portfolioWeightAndReturns(prosper_grade_return_real, "C");
    portfolioWeightAndReturns(prosper_grade_return_real, "D");

    var sample_portfolio_returns = [];

    function weightedAverageList(list_weights, list_input, field, year) {
        var result = 0;
        for (j = 0; j < list_weights.length; j++) {
            var curr_value = 0;
            for (k = 0; k < list_input[j].length; k++) {
                if (list_input[j][k]["Year"] == year) {
                    curr_value = list_input[j][k][field];
                    break;
                }
            }
            result = result + list_weights[j] * curr_value;
        }
        return result
    }
    for (i = 0; i < list_returns_by_grade[0].length; i++) {
        var curr_year = list_returns_by_grade[0][i]["Year"];
        var actual_annual_return = weightedAverageList(list_weightings_by_grade, list_returns_by_grade, "Actual_Return", curr_year);
        var actual_annual_sd = weightedAverageList(list_weightings_by_grade, list_returns_by_grade, "Actual_Sd", curr_year);
        var predict_annual_return = weightedAverageList(list_weightings_by_grade, list_returns_by_grade, "Predict_Return", curr_year);
        var predict_annual_sd = weightedAverageList(list_weightings_by_grade, list_returns_by_grade, "Predict_Sd", curr_year);
        var monthly_return = monthlyReturn(actual_annual_return);
        for (month = 1; month < 13; month++) {
            if (sample_portfolio_returns.length < 1) {
                sample_portfolio_returns.push({
                    "year":curr_year,
                    "month": month,
                    "annual_return": actual_annual_return,
                    "annual_sd": actual_annual_sd,
                    "predict_annual_return": predict_annual_return,
                    "predict_annual_sd": predict_annual_sd,
                    "cumulative_return":1});
            }
            else {
                sample_portfolio_returns.push({
                    "year":curr_year,
                    "month": month,
                    "annual_return": actual_annual_return,
                    "annual_sd": actual_annual_sd,
                    "predict_annual_return": predict_annual_return,
                    "predict_annual_sd": predict_annual_sd,
                    "cumulative_return":sample_portfolio_returns[sample_portfolio_returns.length - 1]["cumulative_return"] * (1 + monthly_return)});
            }
        }
    }
    persistJsonToSessionStorage("sample_portfolio_returns", sample_portfolio_returns);
}

function persistStringToSessionStorage(key, value) {
    if (sessionStorage.getItem(key) == null || sessionStorage.getItem(key) != value)
    {
        sessionStorage.setItem(key, value);
        return true;
    }
    return false;
}

function persistJsonToSessionStorage(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

function validateAndStoreInput() {
    function checkNonNegativeAllocation(grade) {
        var allocation = document.getElementsByName("allocation_" + grade.toLowerCase())[0].valueAsNumber;
        if (allocation < 0) {
            alert("Allocation to " + grade + " grade should be non-negative.");
            return null;
        }
        return allocation / 100;
    }

    function validateAndStoreAllocations(is_goal_changed) {
        var allocations = allocationsForGoals(sessionStorage.getItem("investment_goal"));

        function allocation(grade, allocations, is_goal_changed) {
            var result;
            if (is_goal_changed) {
                result = allocations["allocation_" + grade.toLowerCase()] / 100;
            } else {
                result = checkNonNegativeAllocation(grade);
            }
            return result;
        }

        var allocation_aa = allocation("AA", allocations, is_goal_changed);
        var allocation_a = allocation("A", allocations, is_goal_changed);
        var allocation_b = allocation("B", allocations, is_goal_changed);
        var allocation_c = allocation("C", allocations, is_goal_changed);
        var allocation_d = allocation("D", allocations, is_goal_changed);

        if (allocation_aa == null || allocation_a == null || allocation_b == null || allocation_c == null || allocation_d == null) {
            return;
        }

        var total_allocation = allocation_aa + allocation_a + allocation_b + allocation_c + allocation_d;
        if (total_allocation > 1) {
            alert("Total allocation exceeds 100%. Will apportion the allocatin to each grade accordingly.");
            allocation_aa = allocation_aa / total_allocation;
            allocation_a = allocation_a / total_allocation;
            allocation_b = allocation_b / total_allocation;
            allocation_c = allocation_c / total_allocation;
            allocation_d = allocation_d / total_allocation;
        }

        persistStringToSessionStorage("allocation_aa", allocation_aa);
        document.getElementById("allocation_aa").value = Math.round(allocation_aa * 100);
        persistStringToSessionStorage("allocation_a", allocation_a);
        document.getElementById("allocation_a").value = Math.round(allocation_a * 100);
        persistStringToSessionStorage("allocation_b", allocation_b);
        document.getElementById("allocation_b").value = Math.round(allocation_b * 100);
        persistStringToSessionStorage("allocation_c", allocation_c);
        document.getElementById("allocation_c").value = Math.round(allocation_c * 100);
        persistStringToSessionStorage("allocation_d", allocation_d);
        document.getElementById("allocation_d").value = Math.min(Math.round(allocation_d * 100),
            100 - Math.round(allocation_aa * 100) - Math.round(allocation_a * 100) - Math.round(allocation_b * 100) - Math.round(allocation_c * 100));
    }

    var goal_updated = validateAndStoreGoal();
    validateAndStoreSize();
    validateAndStoreAllocations(goal_updated);

    function validateAndStoreGoal() {
        var goal = document.getElementById("analysis_dropdown_goal");
        var goal_updated = persistStringToSessionStorage("investment_goal", goal.options[goal.selectedIndex].text);
        return goal_updated;
    }

    function validateAndStoreSize() {
        var size = document.getElementById("analysis_dropdown_size");
        persistStringToSessionStorage("investment_size", size.options[size.selectedIndex].text);
    }
}

function setDropdownValueByText(selectObj, str) {
    for (var i = 0; i < selectObj.options.length; i++) {
        if (selectObj.options[i].text== str) {
            selectObj.options[i].selected = true;
            return;
        }
    }
}

function storeData() {
    var goal = document.getElementById("dropdown_goal");
    var str_goal = goal.options[goal.selectedIndex].text;

    if (str_goal == "Choose Your Investment Goal:") {
        alert("Please choose a goal to start.");
        return;
    }

    var size = document.getElementById("dropdown_size");
    var str_size = size.options[size.selectedIndex].text;

    if (str_size == "Choose Your Investment Amount:") {
        alert("Please choose an investment size to start.");
        return;
    }

    // myan: parse and store time series data
    persistStringToSessionStorage("investment_goal", str_goal);
    persistStringToSessionStorage("investment_size", str_size);
    persistJsonToSessionStorage("bond_data", bond_time_series);

    function makeNodeDataPerYear(data) {
        var node_data_year = {};
        for (i = 0; i < data.length; i++) {
            if (data[i]["Year"] in node_data_year) {
                node_data_year[data[i]["Year"]].push(data[i]);
            }
            else {
                node_data_year[data[i]["Year"]] = [data[i]];
            }
        }
        return node_data_year;
    }

    var node_data_year_real = makeNodeDataPerYear(node_data_real);
    persistJsonToSessionStorage("node_data_real", node_data_year_real);
    persistJsonToSessionStorage("prosper_grade_return_real", prosper_grade_return_real);

    // d["months_employed"] = +d["months_employed"];
    // d["total_inquiries"] = +d["total_inquiries"];
    // d["bankcard_utilization"] = +d["bankcard_utilization"];
    // d["revolving_balance"] = +d["revolving_balance"];
    // d["all208"] = +d["all208"];
    // d["all701"] = +d["all701"];
    persistJsonToSessionStorage("list_attributes", ["months_employed", "total_inquiries", "bankcard_utilization", "all208"]); //myan: this is where we define the attributes to summarize

    // myan: only store variables and go to the page if the user made sane selections
    window.open("./analysis.html", "_self");
}

function goToAnalysis() {
    window.open("./analysis.html", "_self");
    updateSelections();
    analyze(window.loan_data_real != null);
}

function makeLoanDataYearGrade(data) {
    // {year1:{grade1: [loan1, ...], grade2: [loan2, ...], ...},
    //  year2:{grade1: [loan3, ...], grade2: [loan4, ...], ...}}
    var result = {};
    for (i = 0; i < data.length; i++) {
        var curr_year = data[i]["Year"];
        var curr_grade = data[i]["Grade"];
        if (curr_year in result) {
            if (curr_grade in result[curr_year]) {
                result[curr_year][curr_grade].push(data[i]);
            }
            else {
                result[curr_year][curr_grade] = [data[i]];
            }
        }
        else {
            result[curr_year] = {};
            result[curr_year][curr_grade] = [data[i]];
        }
    }
    return result;
}

function parseBondTimeSeries(input_data, symbol) {
    var x = [];
    var y = [];
    var max_iter = input_data.length; // data.length;

    for (k = 0; k < max_iter; k++) {
        x.push(new Date(input_data[k]["year"], input_data[k]["month"]));
        y.push(input_data[k][symbol]);
    }
    return {
        x: x,
        y: y,
        name: symbol,
        type: "splines"
    };
}

function readBondData(array_data) {
    Plotly.d3.csv("data/bond_time_series.csv", function(data) {
        data.forEach(function(d) {
            d["SHY"] = +d["SHY"];
            d["IEF"] = +d["IEF"];
            d["LQD"] = +d["LQD"];
            d["EMB"] = +d["EMB"];
            d["year"] = +d.year;
            d["month"] = +d.month;
            // myan: async data processing, therefore utilize an array here to store the data
            array_data.push(d);
        });
    });
}


function readProsperGradeDataReal(array_data) {
    Plotly.d3.csv("data/prosper_grade_return_real.csv", function(data) {
        data.forEach(function(d) {
            d["Actual_Return"] = +d["Actual_Return"];
            d["Actual_Sd"] = +d["Actual_Sd"];
            d["Predict_Return"] = +d["Predict_Return"];
            d["Predict_Sd"] = +d["Predict_Sd"];
            d["Year"] = +d["Year"];
            // myan: async data processing, therefore utilize an array here to store the data
            array_data.push(d);
        });
    });
}


function readNodeDataReal(array_data) {
    Plotly.d3.csv("data/node_data_real.csv", function(data) {
        data.forEach(function(d) {
            d["Node_ID"] = +d["Node_ID"];
            d["Amount_Borrowed"] = +d["Amount_Borrowed"];
            d["Actual_Return"] = +d["Actual_Return"];
            d["Predict_Return"] = +d["Predict_Return"];
            d["Predict_Sd"] = +d["Predict_Sd"];
            d["Year"] = +d["Year"];
            // myan: async data processing, therefore utilize an array here to store the data
            array_data.push(d);
        });
    });
}

function readLoanDataReal(array_data) {
    Plotly.d3.csv("data/loan_data_real.csv", function(data) {
        data.forEach(function(d) {
            d["Loan_ID"] = +d["Loan_ID"];
            d["Node_ID"] = +d["Node_ID"];
            d["Year"] = +d["Year"];
            d["Grade"] = d["Grade"];
            // myan: read different attributes
            d["months_employed"] = +d["months_employed"];
            d["total_inquiries"] = +d["total_inquiries"];
            d["bankcard_utilization"] = +d["bankcard_utilization"];
            d["all208"] = +d["all208"];
            d["all701"] = +d["all701"];

            // myan: async data processing, therefore utilize an array here to store the data
            array_data.push(d);
        });
    });
}

function setAllocation(allocation, value) {
    if (sessionStorage.getItem(allocation) != null) {
        document.getElementById(allocation).value = Math.round(+sessionStorage.getItem(allocation) * 100);
    }
    else {
        document.getElementById(allocation).value = value;
    }
}

function allocationsForGoals(goal) {
    var allocations = {};
    if (goal == "I want to outperform the market") {
        allocations = {"allocation_aa":5, "allocation_a":10, "allocation_b":15, "allocation_c":35, "allocation_d":35};
    }
    else if (goal == "I want a balanced portfolio") {
        allocations = {"allocation_aa":20, "allocation_a":20, "allocation_b":20, "allocation_c":20, "allocation_d":20};
    }
    else if (goal == "I want a stable income") {
        allocations = {"allocation_aa":40, "allocation_a":30, "allocation_b":20, "allocation_c":10, "allocation_d":0};
    }
    else {
        allocations = {"allocation_aa":20, "allocation_a":20, "allocation_b":20, "allocation_c":20, "allocation_d":20};
    }
    return allocations;
}

function updateSelections() {
    //TODO: when switching from other pages to analysis page, stored values of goal, size, and weights are lost
    var goal = sessionStorage.getItem("investment_goal");
    setDropdownValueByText(document.getElementById("analysis_dropdown_goal"), goal);

    var size = sessionStorage.getItem("investment_size");
    setDropdownValueByText(document.getElementById("analysis_dropdown_size"), size);

    var allocations = allocationsForGoals(goal);

    setAllocation("allocation_aa", allocations["allocation_aa"]);
    setAllocation("allocation_a", allocations["allocation_a"]);
    setAllocation("allocation_b", allocations["allocation_b"]);
    setAllocation("allocation_c", allocations["allocation_c"]);
    setAllocation("allocation_d", allocations["allocation_d"]);
}

function updateAnalysisPage(has_data) {
    if (has_data) {
        var bond_data = JSON.parse(sessionStorage.getItem("bond_data"));
        plotTimeSeries(bond_data);
        updateSummaryStatisticsTable();
    }
    else {
        emptyPlot();
    }

}

function updateSummaryStatisticsTable() {
    // | Field Name | Sample Portfolio | OptiLender Portfolio |
    var sample_stats = JSON.parse(sessionStorage.getItem("table_sample_stats"));
    var optimal_stats = JSON.parse(sessionStorage.getItem("table_optimal_stats"));
    var list_attributes = JSON.parse(sessionStorage.getItem("list_attributes"));

    var table_attributes = {};
    for (i = 0; i < list_attributes.length; i++) {
        var curr_attribute = list_attributes[i];
        table_attributes[curr_attribute] = document.getElementById("myTable").rows[i + 1].cells;
        table_attributes[curr_attribute][1].innerHTML = round(sample_stats[curr_attribute], 2);
        table_attributes[curr_attribute][2].innerHTML = round(optimal_stats[curr_attribute], 2);
    }
}

function round(value, num_digits){
    var multiplier = Math.pow(10, num_digits);
    return Math.round(value * multiplier) / multiplier;
}

function makeConfidenceInterval(dates, lower, upper) {
    var dates1 = dates.slice();
    var all_dates = dates1.concat(dates.reverse());
    return {
        x: all_dates,
        y: upper.concat(lower.reverse()),
        name: "CI",
        type: "splines",
        fill: "tozerox",
        fillcolor: "rgba(0,100,80,0.2)",
        line: {color: "transparent"}
    };
}

function plotTimeSeries(input_data) {
    var layout = {
        hovermode:'closest',
        title:'Compare Normalized Cumulative Returns',
        showlegend:true,
        legend: {"orientation": "h"}
    };

    var trace_shy = parseBondTimeSeries(input_data, "SHY");
    var trace_ief = parseBondTimeSeries(input_data, "IEF");
    var trace_lqd = parseBondTimeSeries(input_data, "LQD");
    var trace_emb = parseBondTimeSeries(input_data, "EMB");

    var data = [trace_shy, trace_ief, trace_lqd, trace_emb]; //trace2, trace3];

    if (sessionStorage.getItem("sample_portfolio_returns") != null) {
        var sample_returns = parseReturns(JSON.parse(sessionStorage.getItem("sample_portfolio_returns")),
            "Rating Portfolio");
        data.push(sample_returns);
    }

    if (sessionStorage.getItem("optimal_portfolio_returns") != null) {
        var optimal_returns = parseReturns(JSON.parse(sessionStorage.getItem("optimal_portfolio_returns")),
            "Opti-Lender Portfolio");
        data.push(optimal_returns);

        //TODO: look into how to change the color of confidence intervals?
        var optimal_returns_ci = generateConfidenceInterval(optimal_returns);
        data.push(optimal_returns_ci);
    }

    Plotly.newPlot('myDiv', data, layout);
}

function emptyPlot() {
    var layout = {
        hovermode:'closest',
        title:"Tweak weights and press 'Go' to start...",
        showlegend:true,
        legend: {"orientation": "h"}
    };


    var data =[];
    Plotly.newPlot('myDiv', data, layout);
}

function generateConfidenceInterval(data) {
    // data: {x:[list of dates], y:[list of values], ...}
    // output: {x:[list of dates], y:[upper and lower bounds], ...}

    var dates = data["x"].slice();
    var values = data["y"].slice();

    var upper_ratio = 1.2;
    var lower_ratio = 0.8;

    var upper = [];
    var lower = [];

    for (i = 0; i < values.length; i++) {
        upper.push(1 + (values[i] - 1) * upper_ratio);
        lower.push(1 + (values[i] - 1) * lower_ratio);
    }

    return makeConfidenceInterval(dates, lower, upper);
}

function parseReturns(list_returns, series_name) {
    var dates = [];
    var cum_returns = [];
    for (i = 0; i < list_returns.length; i++) {
        dates.push(new Date(list_returns[i]["year"], list_returns[i]["month"]));
        cum_returns.push(list_returns[i]["cumulative_return"]);
    }
    return {
        x: dates,
        y: cum_returns,
        name: series_name,
        type: "splines"
    };
}