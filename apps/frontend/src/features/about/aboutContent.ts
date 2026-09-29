export const featureTiers = [
  {
    title: "Predictors",
    description:
      "variant, gene, and polygenic risk score features that underlie downstream effects."
  },
  {
    title: "Signatures",
    description:
      "tissue and cell-level genetic profiles from transcriptome, proteome, methylome, and related analyses."
  },
  {
    title: "Biomarkers",
    description:
      "Alzheimer-related biomarker signals from CSF, plasma, PET, and MRI sources."
  },
  {
    title: "Outcomes",
    description:
      "clinical and neuropathological phenotypes that represent the lowest causal tier."
  }
] as const;

export const referenceSections = [
  {
    title: "Target",
    references: [
      {
        citation:
          "Beecham GW, Hamilton K, Naj AC et al. Genome-Wide Association Meta-analysis of Neuropathologic Features of Alzheimer’s Disease and Related Dementias. PLoS Genet 2014;10(9):e1004606. https://doi.org/10.1371/journal.pgen.1004606.",
        href: "https://doi.org/10.1371/journal.pgen.1004606"
      },
      {
        citation:
          "Cingolani P, Platts A, Wang LL et al. A program for annotating and predicting the effects of single nucleotide polymorphisms, SnpEff: SNPs in the genome of Drosophila melanogaster strain w1118; iso-2; iso-3. Fly 2012;6(2):80–92. https://doi.org/10.4161/fly.19695.",
        href: "https://doi.org/10.4161/fly.19695"
      },
      {
        citation:
          "Deming Y, Li Z, Kapoor M et al. Genome-wide association study identifies four novel loci associated with Alzheimer’s endophenotypes and disease modifiers. Acta Neuropathol 2017;133(5):839–56. https://doi.org/10.1007/s00401-017-1685-y.",
        href: "https://doi.org/10.1007/s00401-017-1685-y"
      },
      {
        citation:
          "Kunkle BW, Grenier-Boley B, Sims R et al. Genetic meta-analysis of diagnosed Alzheimer’s disease identifies new risk loci and implicates Aβ, tau, immunity and lipid processing. Nat Genet 2019;51(3):414–30. https://doi.org/10.1038/s41588-019-0358-2.",
        href: "https://doi.org/10.1038/s41588-019-0358-2"
      },
      {
        citation:
          "Panitch R, Hu J, Chung J et al. Integrative brain transcriptome analysis links complement component 4 and HSPA2 to the APOE ε2 protective effect in Alzheimer disease. Mol Psychiatry 2021;26(10):6054–64. https://doi.org/10.1038/s41380-021-01266-z.",
        href: "https://doi.org/10.1038/s41380-021-01266-z"
      }
    ]
  },
  {
    title: "Network",
    references: [
      {
        citation:
          "Chung J, Sahelijo N, Maruyama T et al. Alzheimer’s disease heterogeneity explained by polygenic risk scores derived from brain transcriptomic profiles. Alzheimer’s & Dementia 2023;19(11):5173–84. https://doi.org/10.1002/alz.13069.",
        href: "https://doi.org/10.1002/alz.13069"
      },
      {
        citation:
          "Zhang B, Horvath S. A General Framework for Weighted Gene Co-Expression Network Analysis. Statistical Applications in Genetics and Molecular Biology 2005;4(1). https://doi.org/10.2202/1544-6115.1128.",
        href: "https://doi.org/10.2202/1544-6115.1128"
      }
    ]
  },
  {
    title: "Drug",
    references: [
      {
        citation:
          "Aggregate Analysis of ClinicalTrials.gov (AACT) Database. Clinical Trials Transformation Initiative (CTTI). Available at: https://aact.ctti-clinicaltrials.org/ (accessed 24 February 2026).",
        href: "https://aact.ctti-clinicaltrials.org/"
      },
      {
        citation:
          "Corsello SM, Bittker JA, Liu Z et al. The Drug Repurposing Hub: a next-generation drug library and information resource. Nat Med 2017;23(4):405–8. https://doi.org/10.1038/nm.4306.",
        href: "https://doi.org/10.1038/nm.4306"
      },
      {
        citation:
          "Kim S, Chen J, Cheng T et al. PubChem 2025 update. Nucleic Acids Research 2025;53(D1):D1516–25. https://doi.org/10.1093/nar/gkae1059.",
        href: "https://doi.org/10.1093/nar/gkae1059"
      },
      {
        citation:
          "Meng F, Xi Y, Huang J et al. A curated diverse molecular database of blood-brain barrier permeability with chemical descriptors. Sci Data 2021;8(1):289. https://doi.org/10.1038/s41597-021-01069-5.",
        href: "https://doi.org/10.1038/s41597-021-01069-5"
      },
      {
        citation:
          "National Center for Biotechnology Information. PubChem. n.d. https://pubchem.ncbi.nlm.nih.gov/ (accessed 24 February 2026).",
        href: "https://pubchem.ncbi.nlm.nih.gov/"
      },
      {
        citation:
          "Tasneem A, Aberle L, Ananth H et al. The Database for Aggregate Analysis of ClinicalTrials.gov (AACT) and Subsequent Regrouping by Clinical Specialty. PLoS ONE 2012;7(3):e33677. https://doi.org/10.1371/journal.pone.0033677.",
        href: "https://doi.org/10.1371/journal.pone.0033677"
      },
      {
        citation:
          "Wu Z, Ramsundar B, Feinberg EN et al. MoleculeNet: a benchmark for molecular machine learning. Chem Sci 2018;9(2):513–30. https://doi.org/10.1039/C7SC02664A.",
        href: "https://doi.org/10.1039/C7SC02664A"
      }
    ]
  }
] as const;
