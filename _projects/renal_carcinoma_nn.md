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

View Code [[Github](https://github.com/Michaelmvh/Renal-Cell-Carcinoma-Neural-Network-Research-Group-Fall-2022)]

This project, completed through the Informatics Skunkworks group in collaboration with the University of Wisconsin-Madison School of Medicine, focused on automating the grading of renal cell carcinoma (RCC) using deep learning and radiomics.

- Developed a machine learning workflow to classify CT scans of renal cell carcinoma into low-grade or high-grade categories, assisting in non-invasive diagnostic efforts.

- Data Engineering & Pipeline Development: Optimized a segmentation script to isolate kidney regions from three-dimensional CT scans. Engineered a data pipeline to convert 3D .mat files into 2D image slices based on specific volumetric criteria (e.g., largest cross-sectional area or median slice).

- Computer Vision & Transfer Learning: Implemented a transfer learning approach using a ResNet architecture. This required adapting pre-trained weights from general image datasets to the specific grayscale and textural nuances of medical CT imagery.

- Technical Impact: Successfully bridged the gap between raw medical volumetric data and standard deep learning architectures, establishing a foundation for automated radiomic classification.
