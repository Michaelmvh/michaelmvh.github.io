---
layout: page
title: Pancreatic Cysts Prediction Project
description: Imbalanced data!
img: assets/img/publication_preview/pancreatic_cyst.png
importance: 1
category: research
related_publications: true
---

<img src="../../assets/img/publication_preview/pancreatic_cyst.png" height="100%" width="100%">
Image sourced from our publication {% cite Awe2022%}

Project Overview

During my undergraduate research, under the mentorship of Dr. Mingren Shen and Dr. Dane Morgan, I led a three-student team in developing machine learning models to classify pancreatic cysts as potentially cancerous or noncancerous. The primary clinical objective was to provide a recommendation tool that could identify harmful cysts with high sensitivity while remaining specific enough to prevent unnecessary surgical interventions.

Technical Challenges & Methodology

- Data Sourcing: Worked with CT radiomics data provided by the University of Wisconsin School of Medicine.

* Addressing Bias: A major challenge involved mitigating selection bias; because the data was sourced from patients who had already undergone surgery, the dataset was naturally skewed toward more severe cases.

* Model Development: I trained an XGBoost model, addressing the class imbalance through:

  - Resampling: Experimenting with various oversampling and undersampling techniques.

  - Metric Selection: Utilizing specific performance metrics beyond simple accuracy to ensure the model remained robust despite the biased dataset.

  - Feature Engineering: Identified and analyzed key model features to ensure they aligned with medically relevant characteristics.

Key Outcomes

- Leadership: Acted as the lead for a three-student development team, responsible for delegating tasks and maintaining the development schedule.

- Publication: This research resulted in a second-author publication in the journal Abdominal Radiology titled "Machine learning principles applied to CT radiomics to predict mucinous pancreatic cysts".
