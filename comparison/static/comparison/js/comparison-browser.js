(function () {
    var STORAGE_KEY = 'product_comparison';
    var MAX_PRODUCTS = 4;
    var CATEGORY_ORDER = ['PRICING', 'SPECIFICATIONS', 'FEATURES', 'SHIPPING', 'GENERAL'];

    function nowIso() {
        return new Date().toISOString();
    }

    function emptyComparison() {
        return {
            id: 'local_' + Date.now(),
            products: [],
            createdAt: nowIso(),
            updatedAt: nowIso()
        };
    }

    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            document.cookie.split(';').forEach(function (cookie) {
                var trimmed = cookie.trim();
                if (trimmed.substring(0, name.length + 1) === name + '=') {
                    cookieValue = decodeURIComponent(trimmed.substring(name.length + 1));
                }
            });
        }
        return cookieValue;
    }

    function config() {
        var indicator = document.querySelector('[data-compare-indicator]');
        var page = document.getElementById('comparison-page');
        return {
            authenticated: indicator ? indicator.dataset.authenticated === 'true' : false,
            maxProducts: Number((indicator && indicator.dataset.maxProducts) || (page && page.dataset.maxProducts) || MAX_PRODUCTS),
            comparisonUrl: (indicator && indicator.dataset.comparisonUrl) || '/comparison/',
            apiUrl: (indicator && indicator.dataset.apiUrl) || (page && page.dataset.apiUrl) || '/comparison/api/',
            sharedApiUrl: (indicator && indicator.dataset.sharedApiUrl) || (page && page.dataset.sharedApiUrl) || '/comparison/api/shared/',
            sharedDetailTemplate: (page && page.dataset.sharedDetailUrlTemplate) || '/comparison/api/shared/SHARE_ID/'
        };
    }

    function normalizeComparison(value) {
        var comparison = value || emptyComparison();
        comparison.products = Array.isArray(comparison.products) ? comparison.products.slice(0, config().maxProducts) : [];
        comparison.createdAt = comparison.createdAt || nowIso();
        comparison.updatedAt = comparison.updatedAt || nowIso();
        comparison.id = comparison.id || 'local_' + Date.now();
        return comparison;
    }

    function loadLocal() {
        try {
            return normalizeComparison(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
        } catch (error) {
            return emptyComparison();
        }
    }

    function saveLocal(comparison) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(comparison));
    }

    function requestJson(url, options) {
        var requestOptions = options || {};
        requestOptions.headers = Object.assign({
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') || ''
        }, requestOptions.headers || {});
        return fetch(url, requestOptions).then(function (response) {
            return response.json().catch(function () {
                return {};
            }).then(function (payload) {
                if (!response.ok) {
                    throw new Error(payload.error || 'Comparison request failed.');
                }
                return payload;
            });
        });
    }

    function loadServer() {
        return requestJson(config().apiUrl, { method: 'GET' }).then(function (payload) {
            return normalizeComparison(payload.comparison);
        }).catch(function () {
            return loadLocal();
        });
    }

    function saveServer(comparison) {
        return requestJson(config().apiUrl, {
            method: 'POST',
            body: JSON.stringify({ comparison: comparison })
        });
    }

    function loadComparison() {
        if (config().authenticated) {
            return loadServer();
        }
        return Promise.resolve(loadLocal());
    }

    function saveComparison(comparison) {
        comparison.updatedAt = nowIso();
        saveLocal(comparison);
        updateIndicator(comparison.products.length);
        if (config().authenticated) {
            return saveServer(comparison).catch(function () {
                showFeedback('Comparison saved in this browser. Server sync is temporarily unavailable.', 'warning');
            });
        }
        return Promise.resolve();
    }

    function productFromButton(button) {
        var price = Number(button.dataset.productPrice || 0);
        var available = button.dataset.productAvailable !== 'false';
        var category = button.dataset.productCategory || 'General';
        return {
            id: String(button.dataset.productId || ''),
            name: button.dataset.productName || 'Product',
            price: price,
            imageUrl: button.dataset.productImage || '/static/images/items/1.jpg',
            available: available,
            attributes: [
                { name: 'Price', value: price, category: 'PRICING', type: 'CURRENCY' },
                { name: 'Category', value: category, category: 'GENERAL', type: 'TEXT' },
                { name: 'Available', value: available, category: 'GENERAL', type: 'BOOLEAN' }
            ]
        };
    }

    function showFeedback(message, level) {
        var feedback = document.getElementById('comparison-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'comparison-feedback';
            feedback.className = 'comparison-feedback';
            feedback.setAttribute('aria-live', 'polite');
            document.body.appendChild(feedback);
        }
        feedback.className = 'comparison-feedback comparison-feedback-' + (level || 'info');
        feedback.textContent = message;
        window.clearTimeout(showFeedback.timer);
        showFeedback.timer = window.setTimeout(function () {
            feedback.textContent = '';
        }, 3500);
    }

    function addProduct(product) {
        return loadComparison().then(function (comparison) {
            if (comparison.products.some(function (existing) { return existing.id === product.id; })) {
                showFeedback('This product is already in your comparison.', 'info');
                return comparison;
            }
            if (comparison.products.length >= config().maxProducts) {
                showFeedback('Your comparison already has ' + comparison.products.length + ' products. The maximum is ' + config().maxProducts + '.', 'warning');
                return comparison;
            }

            comparison.products.push(product);
            return saveComparison(comparison).then(function () {
                showFeedback(product.name + ' added to comparison (' + comparison.products.length + '/' + config().maxProducts + ').', 'success');
                renderComparisonPage(comparison);
                return comparison;
            });
        });
    }

    function removeProduct(productId) {
        return loadComparison().then(function (comparison) {
            comparison.products = comparison.products.filter(function (product) {
                return product.id !== productId;
            });
            return saveComparison(comparison).then(function () {
                renderComparisonPage(comparison);
                return comparison;
            });
        });
    }

    function updateIndicator(count) {
        var indicator = document.querySelector('[data-compare-indicator]');
        if (!indicator) {
            return;
        }
        var label = indicator.querySelector('[data-compare-count]');
        if (label) {
            label.textContent = count + ' / ' + config().maxProducts;
        }
        indicator.classList.toggle('comparison-indicator-full', count >= config().maxProducts);
    }

    function collectAttributes(products) {
        var byName = {};
        products.forEach(function (product) {
            (product.attributes || []).forEach(function (attribute) {
                if (!byName[attribute.name]) {
                    byName[attribute.name] = attribute;
                }
            });
        });
        return Object.keys(byName).map(function (name) {
            return byName[name];
        }).sort(function (left, right) {
            var categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
            if (categoryDelta !== 0) {
                return categoryDelta;
            }
            return left.name.localeCompare(right.name);
        });
    }

    function attributeValue(product, name) {
        return (product.attributes || []).find(function (attribute) {
            return attribute.name === name;
        }) || null;
    }

    function bestProductIds(products, attributeName) {
        var values = products.map(function (product) {
            var attribute = attributeName === 'Price'
                ? { value: product.price, type: 'CURRENCY' }
                : attributeValue(product, attributeName);
            return attribute && typeof attribute.value === 'number'
                ? { id: product.id, value: attribute.value, type: attribute.type }
                : null;
        }).filter(Boolean);
        if (!values.length) {
            return {};
        }
        var preferLowest = attributeName.toLowerCase().indexOf('price') >= 0 || values[0].type === 'CURRENCY';
        var best = values.reduce(function (currentBest, entry) {
            return preferLowest ? Math.min(currentBest, entry.value) : Math.max(currentBest, entry.value);
        }, values[0].value);
        return values.reduce(function (ids, entry) {
            if (entry.value === best) {
                ids[entry.id] = true;
            }
            return ids;
        }, {});
    }

    function formatValue(attribute) {
        if (!attribute) {
            return 'N/A';
        }
        if (attribute.type === 'BOOLEAN' || typeof attribute.value === 'boolean') {
            return attribute.value ? 'Yes' : 'No';
        }
        if (attribute.type === 'CURRENCY' && typeof attribute.value === 'number') {
            return '$' + attribute.value.toFixed(2);
        }
        if (attribute.type === 'RATING' && typeof attribute.value === 'number') {
            return attribute.value.toFixed(1) + ' / 5';
        }
        var text = String(attribute.value);
        return text.length > 80 ? text.slice(0, 77) + '...' : text;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderComparisonPage(comparison) {
        var page = document.getElementById('comparison-page');
        if (!page) {
            return;
        }
        comparison = normalizeComparison(comparison || loadLocal());
        updateIndicator(comparison.products.length);

        if (comparison.products.length === 0) {
            page.innerHTML = '<div class="comparison-empty">Add products to compare side by side.</div>';
            return;
        }

        var attributes = collectAttributes(comparison.products);
        var productHeaders = comparison.products.map(function (product) {
            return '<th scope="col" class="' + (product.available ? '' : 'comparison-product-unavailable') + '">' +
                '<img class="comparison-product-image" src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">' +
                '<strong>' + escapeHtml(product.name) + '</strong>' +
                '<span>$' + Number(product.price).toFixed(2) + '</span>' +
                (product.available ? '' : '<span class="comparison-unavailable">Unavailable</span>') +
                '<button type="button" class="btn btn-sm btn-outline-danger" data-compare-remove="' + escapeHtml(product.id) + '">Remove</button>' +
                '</th>';
        }).join('');
        var rows = attributes.map(function (attribute) {
            var bestIds = bestProductIds(comparison.products, attribute.name);
            var cells = comparison.products.map(function (product) {
                var value = attributeValue(product, attribute.name);
                var classes = [];
                if (!value) {
                    classes.push('comparison-missing-value');
                }
                if (bestIds[product.id]) {
                    classes.push('comparison-best-value');
                }
                return '<td class="' + classes.join(' ') + '">' + escapeHtml(formatValue(value)) + '</td>';
            }).join('');
            return '<tr><th scope="row">' + escapeHtml(attribute.name) + '</th>' + cells + '</tr>';
        }).join('');

        page.innerHTML =
            '<div class="comparison-actions">' +
                '<button type="button" class="btn btn-primary" data-compare-share><i class="fa fa-share-alt"></i> Share</button>' +
            '</div>' +
            '<div class="table-responsive comparison-table-wrap">' +
                '<table class="table table-bordered comparison-table">' +
                    '<thead><tr><th scope="col">Attribute</th>' + productHeaders + '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>';
    }

    function shareComparison() {
        return loadComparison().then(function (comparison) {
            return requestJson(config().sharedApiUrl, {
                method: 'POST',
                body: JSON.stringify({ comparison: comparison })
            }).then(function (payload) {
                var url = payload.url || window.location.origin + config().comparisonUrl + 'shared/' + payload.shareId + '/';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).catch(function () {});
                }
                showFeedback('Share link copied: ' + url, 'success');
            });
        }).catch(function (error) {
            showFeedback(error.message || 'Unable to create share link.', 'warning');
        });
    }

    function bindEvents() {
        document.addEventListener('click', function (event) {
            var target = event.target;
            var addButton = target.closest ? target.closest('[data-compare-add]') : null;
            var removeButton = target.closest ? target.closest('[data-compare-remove]') : null;
            var shareButton = target.closest ? target.closest('[data-compare-share]') : null;
            var indicator = target.closest ? target.closest('[data-compare-indicator]') : null;

            if (addButton) {
                event.preventDefault();
                addProduct(productFromButton(addButton));
            } else if (removeButton) {
                event.preventDefault();
                removeProduct(removeButton.dataset.compareRemove);
            } else if (shareButton) {
                event.preventDefault();
                shareComparison();
            } else if (indicator) {
                event.preventDefault();
                window.location.href = config().comparisonUrl;
            }
        });
    }

    function initPage() {
        var page = document.getElementById('comparison-page');
        if (!page) {
            return loadComparison().then(function (comparison) {
                updateIndicator(comparison.products.length);
            });
        }

        var shareId = page.dataset.shareId;
        if (shareId) {
            var url = config().sharedDetailTemplate.replace('SHARE_ID', encodeURIComponent(shareId));
            return requestJson(url, { method: 'GET' }).then(function (payload) {
                var comparison = normalizeComparison(payload.comparison);
                renderComparisonPage(comparison);
            }).catch(function (error) {
                page.innerHTML = '<div class="alert alert-warning">' + escapeHtml(error.message || 'Shared comparison unavailable.') + '</div>';
            });
        }

        return loadComparison().then(function (comparison) {
            renderComparisonPage(comparison);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        bindEvents();
        initPage();
    });
})();
