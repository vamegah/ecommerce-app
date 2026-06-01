(function () {
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            var cookies = document.cookie.split(";");
            for (var i = 0; i < cookies.length; i += 1) {
                var cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function showToast(message, level) {
        var toast = document.getElementById("wishlist-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "wishlist-toast";
            toast.className = "wishlist-toast";
            document.body.appendChild(toast);
        }
        toast.className = "wishlist-toast " + (level || "info");
        toast.textContent = message;
        toast.style.opacity = "1";
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(function () {
            toast.style.opacity = "0";
        }, 2200);
    }

    function updateWishlistCount(count) {
        var badge = document.getElementById("wishlist-count-badge");
        if (badge) {
            badge.textContent = String(count);
        }
    }

    function updateWishlistIcon(button, inWishlist) {
        if (!button) {
            return;
        }
        var icon = button.querySelector("i");
        button.classList.toggle("active", inWishlist);
        if (icon) {
            icon.className = "fa " + (inWishlist ? "fa-heart" : "fa-heart-o");
        }
    }

    function addToWishlist(productId, button) {
        return fetch("/wishlist/add/" + productId + "/", {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken") || ""
            }
        }).then(function (response) {
            if (response.status === 401) {
                window.location.href = "/accounts/login/?next=" + encodeURIComponent(window.location.pathname) + "&wishlist_action=add&product_id=" + productId;
                return null;
            }
            if (!response.ok) {
                throw new Error("Failed to add product.");
            }
            return response.json();
        }).then(function (payload) {
            if (!payload) {
                return;
            }
            updateWishlistCount(payload.wishlist_count);
            updateWishlistIcon(button, true);
            showToast(payload.message || "Added to wishlist.", "success");
        }).catch(function () {
            showToast("Unable to update wishlist.", "error");
        });
    }

    function removeFromWishlist(productId, button) {
        return fetch("/wishlist/remove/" + productId + "/", {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken") || ""
            }
        }).then(function (response) {
            if (response.status === 401) {
                window.location.href = "/accounts/login/?next=" + encodeURIComponent(window.location.pathname);
                return null;
            }
            if (!response.ok) {
                throw new Error("Failed to remove product.");
            }
            return response.json();
        }).then(function (payload) {
            if (!payload) {
                return;
            }
            updateWishlistCount(payload.wishlist_count);
            updateWishlistIcon(button, false);
            showToast(payload.message || "Removed from wishlist.", "info");
            if (button && button.classList.contains("wishlist-remove-btn")) {
                var card = button.closest(".col-md-4");
                if (card) {
                    card.remove();
                }
            }
        }).catch(function () {
            showToast("Unable to update wishlist.", "error");
        });
    }

    function addFromWishlistToCart(button) {
        var productId = button.dataset.productId;
        var hasVariations = button.dataset.hasVariations === "true";
        if (hasVariations) {
            window.location.href = button.dataset.productUrl;
            return;
        }
        fetch("/cart/add_to_cart/" + productId + "/", {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken") || ""
            }
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("Failed to add to cart.");
            }
            showToast("Added to cart.", "success");
            var cartBadge = document.querySelector(".fa-shopping-cart") ? document.querySelector(".fa-shopping-cart").closest("a").querySelector(".notify") : null;
            if (cartBadge && !isNaN(Number(cartBadge.textContent))) {
                cartBadge.textContent = String(Number(cartBadge.textContent) + 1);
            }
        }).catch(function () {
            showToast("Unable to add to cart.", "error");
        });
    }

    document.addEventListener("click", function (event) {
        var toggleButton = event.target.closest(".wishlist-toggle-btn");
        if (toggleButton) {
            event.preventDefault();
            var productId = toggleButton.dataset.productId;
            if (toggleButton.classList.contains("active")) {
                removeFromWishlist(productId, toggleButton);
            } else {
                addToWishlist(productId, toggleButton);
            }
            return;
        }

        var removeButton = event.target.closest(".wishlist-remove-btn");
        if (removeButton) {
            event.preventDefault();
            removeFromWishlist(removeButton.dataset.productId, removeButton);
            return;
        }

        var addCartButton = event.target.closest(".wishlist-add-cart-btn");
        if (addCartButton) {
            event.preventDefault();
            addFromWishlistToCart(addCartButton);
        }
    });
})();
