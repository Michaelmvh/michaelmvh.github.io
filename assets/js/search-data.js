// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-baking",
          title: "baking",
          description: "A few things I&#39;ve baked recently that I wanted to share!",
          section: "Navigation",
          handler: () => {
            window.location.href = "/baking/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Writeups of some of the projects I&#39;ve had the opporunity to be a part of!",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "bakes-cranberry-pomegranate-mousse-pie",
          title: 'Cranberry-Pomegranate Mousse Pie',
          description: "My new Thanksgiving tradition!",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/cranberry_mousse_pie/";
            },},{id: "bakes-fruit-pizza",
          title: 'Fruit Pizza',
          description: "Reminds me of midwest summers",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/fruit_pizza/";
            },},{id: "bakes-frozen-margarita-pie",
          title: 'Frozen Margarita Pie',
          description: "A simple summer recipe from Andy Baraghani at Bon Appetit",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/margarita_pie/";
            },},{id: "bakes-homemade-pizza",
          title: 'Homemade Pizza',
          description: "Pizza time!",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/pizza/";
            },},{id: "bakes-smores-tart",
          title: 'Smores Tart',
          description: "One of the many recipes I enjoy from &quot;What&#39;s for Dessert&quot; by Claire Saffitz",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/smores_tart/";
            },},{id: "bakes-strawberry-rhubarb-pie",
          title: 'Strawberry Rhubarb Pie',
          description: "A strawberry rhubarb pie made with freshly picked strawberries",
          section: "Bakes",handler: () => {
              window.location.href = "/bakes/strawberry_rhubarb_pie/";
            },},{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/the_godfather/";
            },},{id: "news-a-simple-inline-announcement",
          title: 'A simple inline announcement.',
          description: "",
          section: "News",},{id: "news-a-long-announcement-with-details",
          title: 'A long announcement with details',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/announcement_2/";
            },},{id: "news-a-simple-inline-announcement-with-markdown-emoji-sparkles-smile",
          title: 'A simple inline announcement with Markdown emoji! :sparkles: :smile:',
          description: "",
          section: "News",},{id: "projects-cheesehacks",
          title: 'CheeseHacks',
          description: "A hackathon that I cofounded and helped host not just once, but twice!",
          section: "Projects",handler: () => {
              window.location.href = "/projects/cheesehacks/";
            },},{id: "projects-pancreatic-cysts-prediction-project",
          title: 'Pancreatic Cysts Prediction Project',
          description: "My first research project. I learned a lot!",
          section: "Projects",handler: () => {
              window.location.href = "/projects/pancreatic_cyst/";
            },},{id: "projects-renal-aml-classification-project",
          title: 'Renal AML Classification Project',
          description: "Building upon my previous experience",
          section: "Projects",handler: () => {
              window.location.href = "/projects/renal_aml_classification/";
            },},{id: "projects-renal-cell-carcinoma-classification-project",
          title: 'Renal Cell Carcinoma Classification Project',
          description: "The last project I worked on during my undergrad",
          section: "Projects",handler: () => {
              window.location.href = "/projects/renal_carcinoma_nn/";
            },},{id: "projects-soccernet-plus",
          title: 'SoccerNet Plus',
          description: "A class project about Computer Vision",
          section: "Projects",handler: () => {
              window.location.href = "/projects/soccernet_plus/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/example_pdf.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%79%6F%75@%65%78%61%6D%70%6C%65.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-inspire',
        title: 'Inspire HEP',
        section: 'Socials',
        handler: () => {
          window.open("https://inspirehep.net/authors/1010907", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=qc6CJjYAAAAJ", "_blank");
        },
      },{
        id: 'social-custom_social',
        title: 'Custom_social',
        section: 'Socials',
        handler: () => {
          window.open("https://www.alberteinstein.com/", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
