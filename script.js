// Select the main content div by its ID
const mainContent = document.getElementById("mainContent");
// mainContent will be used to dynamically change the Home or Story content

// Select the About Me div by its ID
const aboutDiv = document.getElementById("aboutMe");
// aboutDiv will hold the About Me section content and can be shown or hidden

// Define the Home section HTML content
const homeContent = `<p>Explore, Read, and Enjoy your journey through our stories</p>`;
// Stores the HTML string for the Home section, injected into mainContent when "Home" is clicked

// Define the About Me section HTML content
const aboutContent = `
    <h2>About Me</h2>
    <p>I am proud to share the beautiful dreams from my imagination with you. Everything written comes entirely from the worlds I visit each night when I close my eyes. I hope you enjoy it and take the time to read it. If you have any suggestions or find any bugs on the site, please do not hesitate to contact me at "StoryWhiteBlue@gmail.com". Let’s make our site even better.</p>
    <p>Sincerely,<br>Erkan</p>
    <p>Check out my GitHub:</p>
    <a href="https://github.com/ErkanSoftwareDeveloper" target="_blank" class="github-link">
        <img src="github-mark-white.svg" alt="GitHub" class="github-icon">
    </a>
`;
// Stores multi-line HTML for the About Me section
// Includes headings, paragraphs, line breaks, and a GitHub link with an image

// Add click event to the Home button
document.getElementById("Home").onclick = (e) => {
    e.preventDefault(); // Prevent the default link behavior (no page reload)
    mainContent.innerHTML = homeContent; // Inject Home content into mainContent div
    mainContent.style.display = "flex"; // Show the main content area
    aboutDiv.style.display = "none"; // Hide the About Me section
    document.getElementById("Sag").style.display = "flex"; // Show the right sidebar
};

// Add click event to the About Me button
document.getElementById("About").onclick = (e) => {
    e.preventDefault(); // Prevent default link behavior
    mainContent.style.display = "none"; // Hide main content area
    aboutDiv.innerHTML = aboutContent; // Inject About Me content into aboutDiv
    aboutDiv.style.display = "flex"; // Show About Me section
    document.getElementById("Sag").style.display = "none"; // Hide the right sidebar
};

// Add click event for each section in the sidebar
document.querySelectorAll("#sectionList li").forEach(li => {
    li.onclick = () => { // When a sidebar item is clicked
        const section = li.dataset.section;
        // Get the value of "data-section" attribute (e.g., "kotuAdam")

        mainContent.style.display = "flex"; // Show main content area

        // Fetch the JSON file corresponding to the clicked section
        fetch(`stories/${section}.json`)
            .then(res => res.json()) // Convert the response to JSON
            .then(data => {
                mainContent.innerHTML = `
                    <h2 class="section-title">${data[0].title}</h2>
                    <p class="section-text">${data[0].text}</p>
                `;
                // Inject the title and text from JSON into mainContent
            })
            .catch(err => console.error("JSON yüklenemedi:", err));
        // Handle errors if JSON file cannot be loaded

        aboutDiv.style.display = "none"; // Hide About Me section
        document.getElementById("Sag").style.display = "flex";
        // Ensure the sidebar remains visible
    };
});
