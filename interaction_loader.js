/**
 * Асинхронный загрузчик виджета
 * Этот скрипт находит контейнер, показывает preloader и загружает контент с бэкенда.
 */
(function() {
    // URL вашего PHP-обработчика.
    const backendUrl = 'https://zraz.com/widget-handler.php';

    // Находим на странице контейнер для нашего виджета по data-атрибуту
    const widgetContainer = document.querySelector('[data-interaction-container]');

    // Если контейнер не найден, ничего не делаем
    if (!widgetContainer) {
        console.warn('Widget container [data-interaction-container] not found on the page.');
        return;
    }

    // Добавляем отступы к контейнеру виджета
    widgetContainer.style.marginTop = '6px';
    widgetContainer.style.marginBottom = '2px';

    // --- Создаем и показываем анимацию загрузки ---

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


    // --- Загружаем основной контент виджета с логикой повторных попыток ---

    const payload = {
        pageUrl: window.location.href,
        htmlContent: document.documentElement.outerHTML
    };

    let isWidgetLoaded = false;

    function fetchWidgetData() {
        if (isWidgetLoaded) {
            return; // Не отправляем новый запрос, если виджет уже успешно загружен
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

            // 1. Вставляем HTML-контент
            widgetContainer.innerHTML = data.html_content;
            
            // 2. Устанавливаем флаг, что HTML загружен, чтобы остановить повторные запросы
            isWidgetLoaded = true; 

            // 3. Находим все теги <script> внутри вставленного HTML
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
                            resolve(); // Важно: разрешаем Promise даже при ошибке, чтобы не блокировать основной JS
                        };
                        document.body.appendChild(newScript);
                    });
                    promises.push(promise);
                }
                scriptTag.remove();
            });

            // 4. Ждем, пока все внешние библиотеки загрузятся (или не загрузятся)
            return Promise.all(promises).then(() => {
                // 5. После этого выполняем основной JS-код виджета
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
                 setTimeout(fetchWidgetData, 10000); // Повторный вызов через 10 секунд только если загрузка не удалась
            }
        });
    }

    // Первый запуск загрузки данных
    fetchWidgetData();

})();