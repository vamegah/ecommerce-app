(function () {
    'use strict';

    function closestElement(target, selector) {
        if (!(target instanceof Element)) {
            return null;
        }
        return target.closest(selector);
    }

    function closeDropdown(dropdown) {
        var toggle = dropdown.querySelector('[data-toggle="dropdown"]');
        var menu = dropdown.querySelector('.dropdown-menu');

        dropdown.classList.remove('show');
        if (menu) {
            menu.classList.remove('show');
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
        }
    }

    function closeOtherDropdowns(currentDropdown) {
        document.querySelectorAll('.dropdown.show').forEach(function (dropdown) {
            if (dropdown !== currentDropdown) {
                closeDropdown(dropdown);
            }
        });
    }

    function setupDropdowns() {
        document.addEventListener('click', function (event) {
            var toggle = closestElement(event.target, '[data-toggle="dropdown"]');
            var dropdown = toggle ? toggle.closest('.dropdown') : null;

            if (toggle && dropdown) {
                var menu = dropdown.querySelector('.dropdown-menu');
                var willOpen = !dropdown.classList.contains('show');

                event.preventDefault();
                closeOtherDropdowns(dropdown);
                dropdown.classList.toggle('show', willOpen);
                if (menu) {
                    menu.classList.toggle('show', willOpen);
                }
                toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                return;
            }

            if (closestElement(event.target, '.dropdown-menu')) {
                return;
            }

            closeOtherDropdowns(null);
        });
    }

    function setupNavbarCollapse() {
        document.querySelectorAll('[data-toggle="collapse"]').forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                var targetSelector = toggle.getAttribute('data-target');
                var target = targetSelector ? document.querySelector(targetSelector) : null;
                var willOpen;

                if (!target) {
                    return;
                }

                willOpen = !target.classList.contains('show');
                target.classList.toggle('show', willOpen);
                toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        });
    }

    function setupChoiceCards() {
        document.querySelectorAll('.js-check input[type="radio"]').forEach(function (input) {
            input.addEventListener('change', function () {
                if (!input.checked) {
                    return;
                }

                document.querySelectorAll('.js-check input[type="radio"]').forEach(function (radio) {
                    if (radio.name === input.name) {
                        var card = radio.closest('.js-check');
                        if (card) {
                            card.classList.remove('active');
                        }
                    }
                });

                if (input.closest('.js-check')) {
                    input.closest('.js-check').classList.add('active');
                }
            });
        });

        document.querySelectorAll('.js-check input[type="checkbox"]').forEach(function (input) {
            input.addEventListener('change', function () {
                var card = input.closest('.js-check');
                if (card) {
                    card.classList.toggle('active', input.checked);
                }
            });
        });
    }

    function setupDismissibleAlerts() {
        document.addEventListener('click', function (event) {
            var dismissButton = closestElement(event.target, '[data-dismiss="alert"]');
            var alert;

            if (!dismissButton) {
                return;
            }

            alert = dismissButton.closest('.alert');
            if (alert) {
                (alert.closest('#message') || alert).remove();
            }
        });
    }

    function fadeMessages() {
        document.querySelectorAll('#message').forEach(function (message) {
            window.setTimeout(function () {
                message.style.transition = 'opacity 250ms ease';
                message.style.opacity = '0';

                window.setTimeout(function () {
                    if (message.parentNode) {
                        message.remove();
                    }
                }, 300);
            }, 3000);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupDropdowns();
        setupNavbarCollapse();
        setupChoiceCards();
        setupDismissibleAlerts();
        fadeMessages();
    });
}());
