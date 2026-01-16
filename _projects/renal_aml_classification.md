---
layout: page
title: Renal AML Classification Project
description: Building upon my previous experience
img: assets/img/projects/renal_aml_code.png
importance: 1
category: research
---

Original writeup and relevant code can be found on [[Github](https://github.com/Michaelmvh/Renal-AML-Regression-Classification-Spring-2022/tree/main)]

During the spring of 2022, I served as a lead researcher within the Informatics Skunkworks group at the University of Wisconsin - Madison. In this role, I led a team of undergraduate students to explore whether machine learning could accurately predict the growth patterns of renal angiomyolipomas (AMLs), a type of kidney tumor.

### Research Objective & Data Engineering

The primary goal was to develop models that could either predict the specific growth rate of a tumor (regression) or categorize it into "high growth" versus "low growth" groups (classification).

- Dataset Composition: The raw data included patient clinical info and extracted features, totaling 653 entries with 706 initial columns.

* Pipeline Development: I developed a data transformation pipeline to clean the dataset. This involved removing medically irrelevant features, handling missing data, and performing one-hot encoding for categorical variables to prevent models from inferring an artificial order.

* Feature Refinement: After preprocessing and removing features to prevent data leakage, the feature set was narrowed to 399 medically relevant columns.

### Methodological Approach

My team and I implemented a dual-pronged analysis using several machine learning and deep learning frameworks:

| Approach       | Models Utilized                                                                          | Metrics Tracked                                 |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Regression     | PyTorch Neural Networks (4-layer linear), XGBoost, and Gaussian Process Regressor (GPR). | Mean Squared Error (MSE), R2, and Parity Plots. |
| Classification | Support Vector Machines (SVM), XGBoost, and Neural Networks.                             | Accuracy, F1 Score, and Geometric Mean (Gmean). |
| Benchmarking   | Naive Classifiers (Majority, Minority, Random, and Stratified).                          | Comparison baseline for model effectiveness.    |

### Analysis & Key Findings

Despite iterating through various architectures and hyperparameter tuning (using tools like GridSearchCV), the results highlighted the significant challenges of predicting biological growth with limited, noisy datasets.

- Regression Hurdles: Regression models consistently underperformed, often yielding negative R2 values (e.g., GPR at −1.248 and XGBoost at −1.249), indicating that the models were not capturing the underlying growth trends effectively.

* Classification Limits: The trained classification models failed to consistently outperform naive classifiers. For instance, while an SVM achieved an accuracy of 0.75, a simple Majority Classifier achieved a similar accuracy of 0.766, suggesting the model was not gaining meaningful predictive power from the features.

* Threshold Impacts: We attempted to improve certainty by focusing only on tumors with high growth rates (e.g., >1 cm/year), but this further reduced the available training data, which negatively impacted model performance.

### Leadership & Academic Growth

While the technical results were not "successful" in terms of predictive accuracy, this project was important to my undergraduate research career. It provided a realistic look at the complexities of medical data and the necessity of rigorous benchmarking. Leading a team required me to delegate tasks, maintain a development schedule, and foster a collaborative environment where we could critically evaluate why certain approaches were failing.

The experience taught me the value of intellectual honesty in research—knowing when to conclude that a current approach or dataset is insufficient and being able to pivot to more promising directions.
