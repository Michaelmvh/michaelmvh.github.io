---
layout: page
title: Renal Cell Carcinoma Classification Project
description: The last project I worked on during my undergrad
img: assets/img/projects/renal_carcinoma.png
importance: 3
category: research
---

<img src="../../assets/img/projects/renal_carcinoma.png" height="100%" width="100%">

Above Reference Image Source: Toquero, Lawrence & Aboumarzouk, Omar & Abbasi, Zahir. (2009). Renal cell carcinoma metastasis to the ovary: A case report. Cases journal. 2. 7472. 10.4076/1757-1626-2-7472.

I joined this Informatics Skunkworks project during my last semester at the University of Wisconsin - Madison. For this project, we were given three dimensional CT images and a script to segment these images into only the relevant area, specifically the kidney. I made some tweaks to the segmenting script and created a pipeline to convert the segmented three dimensional mat files into two dimensional images. The pipeline allowed for converting the three dimensional scan into a series of two dimensional images or an individual image based on chosen criteria (largest slice, middle slice, etc.). I then used transfer learning to train a model that would classify a carcinoma as low grade or high grade. Though I was able to see some initial results, I graduated before being able to see this project to completion.

The actual data used has been excluded due to data handling guidelines

View Code [[Github](https://github.com/Michaelmvh/Renal-Cell-Carcinoma-Neural-Network-Research-Group-Fall-2022)]
