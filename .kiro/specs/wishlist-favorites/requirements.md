# Requirements Document: Wishlist/Favorites

## Introduction

This document specifies the requirements for a wishlist/favorites feature that allows authenticated users to save products for later viewing and purchasing. The feature integrates with the existing GreatKart Django e-commerce application, providing users with the ability to curate a personal collection of products they're interested in.

## Glossary

- **Wishlist_System**: The complete wishlist/favorites feature including data models, views, and UI components
- **Wishlist**: A user's collection of saved products
- **Wishlist_Item**: A single product saved in a user's wishlist
- **User**: An authenticated account holder in the system
- **Product**: An item available for purchase in the store
- **Cart**: The shopping cart where users place items for immediate purchase
- **Navigation**: The site-wide navigation bar/header

## Requirements

### Requirement 1: Add Products to Wishlist

**User Story:** As an authenticated user, I want to add products to my wishlist, so that I can save items I'm interested in for later consideration.

#### Acceptance Criteria

1. WHEN an authenticated user clicks the add-to-wishlist button on a product, THE Wishlist_System SHALL create a new Wishlist_Item for that product
2. WHEN a user attempts to add a product already in their wishlist, THE Wishlist_System SHALL prevent duplicate entries and maintain the existing entry
3. WHEN an unauthenticated user attempts to add a product to wishlist, THE Wishlist_System SHALL redirect them to the login page
4. WHEN a product is successfully added to the wishlist, THE Wishlist_System SHALL provide visual feedback confirming the action
5. WHEN a product is added to the wishlist, THE Wishlist_System SHALL update the wishlist count in the navigation

### Requirement 2: Remove Products from Wishlist

**User Story:** As an authenticated user, I want to remove products from my wishlist, so that I can manage my saved items and remove things I'm no longer interested in.

#### Acceptance Criteria

1. WHEN a user clicks the remove button on a wishlist item, THE Wishlist_System SHALL delete that Wishlist_Item from the database
2. WHEN a wishlist item is removed, THE Wishlist_System SHALL update the wishlist count in the navigation
3. WHEN a wishlist item is removed, THE Wishlist_System SHALL provide visual feedback confirming the removal
4. WHEN the last item is removed from a wishlist, THE Wishlist_System SHALL display an empty state message

### Requirement 3: Display Wishlist Page

**User Story:** As an authenticated user, I want to view all my saved products on a dedicated wishlist page, so that I can review and manage my saved items.

#### Acceptance Criteria

1. WHEN a user navigates to the wishlist page, THE Wishlist_System SHALL display all products in their wishlist with product images, names, and prices
2. WHEN a user has no items in their wishlist, THE Wishlist_System SHALL display an empty state with a message and link to continue shopping
3. WHEN displaying wishlist items, THE Wishlist_System SHALL show the current availability status of each product
4. WHEN a product in the wishlist is out of stock, THE Wishlist_System SHALL visually indicate the unavailability
5. WHEN displaying the wishlist page, THE Wishlist_System SHALL show remove buttons for each item

### Requirement 4: Wishlist Indicators on Product Pages

**User Story:** As an authenticated user, I want to see whether a product is already in my wishlist, so that I know which items I've already saved.

#### Acceptance Criteria

1. WHEN a user views a product that is in their wishlist, THE Wishlist_System SHALL display a filled/active wishlist icon
2. WHEN a user views a product that is not in their wishlist, THE Wishlist_System SHALL display an empty/inactive wishlist icon
3. WHEN a user clicks the wishlist icon on a product already in their wishlist, THE Wishlist_System SHALL remove the product from the wishlist
4. WHEN a user clicks the wishlist icon on a product not in their wishlist, THE Wishlist_System SHALL add the product to the wishlist

### Requirement 5: Move Items from Wishlist to Cart

**User Story:** As an authenticated user, I want to move items from my wishlist to my shopping cart, so that I can easily purchase saved items.

#### Acceptance Criteria

1. WHEN a user clicks the add-to-cart button on a wishlist item, THE Wishlist_System SHALL add the product to the user's cart
2. WHERE a product has variations (color/size), WHEN a user clicks add-to-cart from the wishlist, THE Wishlist_System SHALL redirect the user to the product detail page for variation selection
3. WHERE a product has no variations, WHEN a user clicks add-to-cart from the wishlist, THE Wishlist_System SHALL add the product directly to the cart with default quantity of 1
4. WHEN a product is added to cart from the wishlist, THE Wishlist_System SHALL provide visual feedback confirming the action
5. WHEN a product is added to cart from the wishlist, THE Wishlist_System SHALL keep the item in the wishlist

### Requirement 6: Wishlist Count in Navigation

**User Story:** As an authenticated user, I want to see the number of items in my wishlist in the navigation bar, so that I can quickly know how many items I've saved.

#### Acceptance Criteria

1. WHEN an authenticated user views any page, THE Wishlist_System SHALL display the wishlist count in the navigation bar
2. WHEN the wishlist count changes, THE Wishlist_System SHALL update the displayed count without requiring a page refresh
3. WHEN a user has zero items in their wishlist, THE Wishlist_System SHALL display "0" or hide the count badge
4. WHEN an unauthenticated user views the site, THE Wishlist_System SHALL display the wishlist icon without a count or with "0"

### Requirement 7: Wishlist Persistence

**User Story:** As an authenticated user, I want my wishlist to be saved across sessions, so that my saved items are available whenever I log in.

#### Acceptance Criteria

1. WHEN a user logs out and logs back in, THE Wishlist_System SHALL display all previously saved wishlist items
2. WHEN a user accesses the site from a different device, THE Wishlist_System SHALL display their wishlist items associated with their account
3. WHEN a product is deleted from the store, THE Wishlist_System SHALL remove that product from all user wishlists
4. WHEN a user's account is deleted, THE Wishlist_System SHALL delete all associated wishlist items

### Requirement 8: Wishlist Access Control

**User Story:** As a system administrator, I want wishlist functionality to be restricted to authenticated users, so that wishlists are properly associated with user accounts.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the wishlist page, THE Wishlist_System SHALL redirect them to the login page
2. WHEN an unauthenticated user attempts to add a product to wishlist via API, THE Wishlist_System SHALL return an authentication error
3. WHEN a user logs in after being redirected from wishlist actions, THE Wishlist_System SHALL complete the originally requested action
4. THE Wishlist_System SHALL ensure each user can only access and modify their own wishlist items
