/**
 * Asynchronous widget loader
 * This script finds a container, shows a preloader, and loads content from the backend.
 */
(function() {
    // URL of your PHP handler.
    const backendUrl = 'https://zraz.com/widget-handler.php';

    // Find the container for our widget on the page using a data attribute
    const widgetContainer = document.querySelector('[data-interaction-container]');

    // If the container is not found, do nothing
    if (!widgetContainer) {
        console.warn('Widget container [data-interaction-container] not found on the page.');
        return;
    }

    // Add margins to the widget container
    widgetContainer.style.marginTop = '6px';
    widgetContainer.style.marginBottom = '2px';

    // --- Create and display the loading animation ---

    const styles = `
        .widget-loader {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            min-height: 80px;
            box-sizing: border-box;
        }
        .widget-loader-dot {
            width: 10px;
            height: 10px;
            margin: 0 5px;
            background-color: #cccccc;
            border-radius: 50%;
            animation: widget-loader-bounce 1.4s infinite ease-in-out both;
        }
        .widget-loader-dot:nth-child(1) { animation-delay: -0.32s; }
        .widget-loader-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes widget-loader-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    const loaderHtml = `
        <div class="widget-loader">
            <div class="widget-loader-dot"></div>
            <div class="widget-loader-dot"></div>
            <div class="widget-loader-dot"></div>
        </div>
    `;

    widgetContainer.innerHTML = loaderHtml;


    // --- Load the main widget content with retry logic ---

    const payload = {
        pageUrl: window.location.href,
        htmlContent: document.documentElement.outerHTML
    };

    let isWidgetLoaded = false;

    function fetchWidgetData() {
        if (isWidgetLoaded) {
            return; // Do not send a new request if the widget has already been successfully loaded
        }

        fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                   throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (typeof data.html_content === 'undefined') {
                throw new Error('Invalid JSON response from server: missing html_content.');
            }

            // 1. Insert the HTML content
            widgetContainer.innerHTML = data.html_content;
            
            // 2. Set a flag that the HTML has been loaded to stop retry attempts
            isWidgetLoaded = true; 

            // 3. Find all <script> tags inside the inserted HTML
            const scriptTags = Array.from(widgetContainer.querySelectorAll('script'));
            const promises = [];

            scriptTags.forEach(scriptTag => {
                if (scriptTag.src) {
                    const promise = new Promise((resolve) => {
                        const newScript = document.createElement('script');
                        newScript.src = scriptTag.src;
                        newScript.onload = resolve;
                        newScript.onerror = () => {
                            console.warn(`Could not load external script: ${scriptTag.src}. Continuing execution.`);
                            resolve(); // Important: resolve the Promise even on error to avoid blocking the main JS execution
                        };
                        document.body.appendChild(newScript);
                    });
                    promises.push(promise);
                }
                scriptTag.remove();
            });

            // 4. Wait for all external libraries to load (or fail to load)
            return Promise.all(promises).then(() => {
                // 5. After that, execute the main widget JS code
                if (data.js_content) {
                    const mainScript = document.createElement('script');
                    mainScript.textContent = data.js_content;
                    document.body.appendChild(mainScript);
                }
            });
        })
        .catch(error => {
            console.error('Failed to load widget, retrying in 10 seconds:', error);
            if (!isWidgetLoaded) {
                 setTimeout(fetchWidgetData, 10000); // Retry the call after 10 seconds only if the loading failed
            }
        });
    }

    // Initial data fetch
    fetchWidgetData();

})();
