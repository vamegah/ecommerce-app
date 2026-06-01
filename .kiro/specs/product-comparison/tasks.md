# Implementation Plan: Product Comparison

## Overview

This implementation plan breaks down the product comparison feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to validate correctness early. The implementation follows a bottom-up approach: data models → business logic → persistence → UI components → integration.

## Tasks

- [x] 1. Set up project structure and data models
  - Create directory structure for comparison feature
  - Define TypeScript interfaces for Comparison, Product, ProductAttribute
  - Define enums for AttributeCategory, AttributeType, ComparisonErrorCode
  - Set up fast-check testing library for property-based tests
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.4_

- [x] 2. Implement core ComparisonManager business logic
  - [x] 2.1 Implement addProduct method with validation
    - Validate product not already in comparison (prevent duplicates)
    - Validate comparison not at limit (max 4 products)
    - Add product to comparison and return result
    - _Requirements: 1.1, 1.3, 1.4, 6.1, 6.2_
  
  - [x] 2.2 Write property test for product addition
    - **Property 1: Product Addition Increases Comparison Size**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 Write property test for duplicate prevention
    - **Property 3: Adding Duplicate Products is Idempotent**
    - **Validates: Requirements 1.3**
  
  - [x] 2.4 Write property test for limit enforcement
    - **Property 4: Adding at Limit Fails Gracefully**
    - **Validates: Requirements 1.4, 6.2**
  
  - [x] 2.5 Write property test for comparison size invariant
    - **Property 18: Comparison Size Never Exceeds Limit**
    - **Validates: Requirements 6.1**
  
  - [x] 2.6 Implement removeProduct method
    - Remove product from comparison by ID
    - Maintain order of remaining products
    - Return updated comparison
    - _Requirements: 2.1, 2.4_
  
  - [x] 2.7 Write property test for product removal
    - **Property 6: Product Removal Decreases Comparison Size**
    - **Validates: Requirements 2.1**
  
  - [x] 2.8 Write property test for order preservation
    - **Property 7: Removal Preserves Order of Remaining Products**
    - **Validates: Requirements 2.4**
  
  - [x] 2.9 Implement getComparison and clearComparison methods
    - Simple getter for current comparison state
    - Clear method to reset comparison
    - _Requirements: 2.3_
  
  - [x] 2.10 Write unit tests for edge cases
    - Test empty comparison state
    - Test single product comparison
    - Test removing last product

- [x] 3. Implement persistence layer
  - [x] 3.1 Create PersistenceStrategy interface
    - Define save, load, saveShared, loadShared methods
    - _Requirements: 1.5, 2.2, 5.1, 5.2_
  
  - [x] 3.2 Implement LocalStoragePersistence
    - Implement save to localStorage with key 'product_comparison'
    - Implement load from localStorage
    - Handle quota exceeded errors gracefully
    - _Requirements: 5.5_
  
  - [x] 3.3 Implement ServerPersistence
    - Implement save via API call to server
    - Implement load via API call to server
    - Handle network errors with retry logic
    - _Requirements: 5.4_
  
  - [x] 3.4 Write property test for persistence round-trip
    - **Property 15: Comparison State Round-Trips Through Persistence**
    - **Validates: Requirements 5.2**
  
  - [x] 3.5 Write property test for persistence strategy selection
    - **Property 16: Correct Persistence Strategy is Selected**
    - **Validates: Requirements 5.4, 5.5**
  
  - [x] 3.6 Write property test for modification persistence
    - **Property 5: Modifications Persist Correctly**
    - **Validates: Requirements 1.5, 2.2**
  
  - [x] 3.7 Integrate persistence with ComparisonManager
    - Call persistence save after add/remove operations
    - Implement async error handling for persistence failures
    - _Requirements: 1.5, 2.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement sharing functionality
  - [x] 5.1 Implement generateShareableUrl method
    - Generate unique share ID
    - Save comparison snapshot to shared storage
    - Return shareable URL with share ID
    - _Requirements: 7.1, 7.2_
  
  - [x] 5.2 Implement loadSharedComparison method
    - Load comparison from share ID
    - Handle expired shares gracefully
    - Handle invalid share IDs
    - _Requirements: 7.2, 7.3_
  
  - [x] 5.3 Write property test for share URL uniqueness
    - **Property 20: Share URLs Are Unique**
    - **Validates: Requirements 7.1**
  
  - [x] 5.4 Write property test for shared comparison round-trip
    - **Property 21: Shared Comparisons Round-Trip Correctly**
    - **Validates: Requirements 7.2**
  
  - [x] 5.5 Write unit tests for sharing edge cases
    - Test expired share ID
    - Test invalid share ID
    - Test sharing empty comparison

- [x] 6. Implement attribute normalization and comparison logic
  - [x] 6.1 Implement collectAttributes function
    - Collect all unique attribute names across products
    - Sort attributes by category and display priority
    - _Requirements: 3.3, 4.4_
  
  - [x] 6.2 Implement getAttributeValue function
    - Get attribute value for product, return null if missing
    - Handle missing attributes gracefully
    - _Requirements: 3.3_
  
  - [x] 6.3 Write property test for attribute display
    - **Property 9: All Unique Attributes Are Displayed**
    - **Validates: Requirements 3.3**
  
  - [x] 6.4 Write property test for attribute grouping
    - **Property 14: Attributes Are Grouped by Category**
    - **Validates: Requirements 4.4**
  
  - [x] 6.5 Implement highlightBestValue function
    - Identify best numeric value (lowest price, highest rating)
    - Mark value for highlighting in UI
    - _Requirements: 4.1_
  
  - [x] 6.6 Write property test for best value highlighting
    - **Property 11: Best Numeric Values Are Highlighted**
    - **Validates: Requirements 4.1**
  
  - [x] 6.7 Implement product availability checking
    - Check if products in saved comparison are still available
    - Mark unavailable products appropriately
    - _Requirements: 5.6_
  
  - [x] 6.8 Write property test for unavailable product handling
    - **Property 17: Unavailable Products Are Marked**
    - **Validates: Requirements 5.6**

- [x] 7. Implement ComparisonTable UI component
  - [x] 7.1 Create ComparisonTable component structure
    - Set up React component with props interface
    - Implement basic render method
    - _Requirements: 3.1, 3.2_
  
  - [x] 7.2 Implement renderProductColumn method
    - Render product image, name, price at top
    - Render attribute values in column
    - Handle missing attributes with "N/A"
    - _Requirements: 3.2, 3.3, 3.5_
  
  - [x] 7.3 Write property test for table structure
    - **Property 8: Comparison Table Structure is Consistent**
    - **Validates: Requirements 3.1, 3.2**
  
  - [x] 7.4 Write property test for essential product info
    - **Property 10: Essential Product Information is Displayed**
    - **Validates: Requirements 3.5**
  
  - [x] 7.5 Implement renderAttributeRow method
    - Render attribute name in first column
    - Render values for each product
    - Apply highlighting for best values
    - _Requirements: 3.2, 4.1_
  
  - [x] 7.6 Implement attribute value rendering
    - Render boolean attributes with consistent icons
    - Render text attributes with truncation for long text
    - Render numeric attributes with proper formatting
    - _Requirements: 4.2, 4.3_
  
  - [x] 7.7 Write property test for boolean rendering consistency
    - **Property 12: Boolean Attributes Render Consistently**
    - **Validates: Requirements 4.2**
  
  - [x] 7.8 Write property test for text attribute handling
    - **Property 13: Long Text Attributes Are Handled**
    - **Validates: Requirements 4.3**
  
  - [x] 7.9 Implement product removal UI
    - Add remove button to each product column
    - Wire up onRemoveProduct callback
    - _Requirements: 2.1_
  
  - [x] 7.10 Implement share button UI
    - Add share button to comparison table
    - Wire up onShare callback
    - Implement clipboard copy functionality
    - _Requirements: 7.4_
  
  - [x] 7.11 Write unit test for empty comparison display
    - Test that empty state shows instructions
    - _Requirements: 2.3, 5.3_

- [x] 8. Implement ComparisonIndicator UI component
  - [x] 8.1 Create ComparisonIndicator component
    - Display current product count and max limit
    - Make clickable to navigate to comparison page
    - Position persistently in UI
    - _Requirements: 8.1, 8.2_
  
  - [x] 8.2 Write property test for indicator count display
    - **Property 22: Comparison Indicator Shows Correct Count**
    - **Validates: Requirements 8.1**
  
  - [x] 8.3 Implement visual feedback for additions
    - Show toast/notification when product added
    - Update indicator count immediately
    - _Requirements: 8.4_
  
  - [x] 8.4 Write property test for modification feedback
    - **Property 23: Modification Feedback is Provided**
    - **Validates: Requirements 8.4**

- [x] 9. Implement error handling and notifications
  - [x] 9.1 Create ComparisonError class
    - Define error codes enum
    - Include error message and recoverable flag
    - _Requirements: 1.4, 6.2, 6.3_
  
  - [x] 9.2 Implement error notification UI
    - Display inline errors for validation failures
    - Display toast notifications for persistence errors
    - Display modal dialogs for critical errors
    - _Requirements: 1.4, 6.3_
  
  - [x] 9.3 Write property test for limit notification content
    - **Property 19: Limit Notification Contains Required Information**
    - **Validates: Requirements 6.3**
  
  - [x] 9.4 Implement graceful degradation
    - Handle persistence failures with in-memory fallback
    - Handle missing images with placeholders
    - Handle unavailable products with notifications
    - _Requirements: 5.6_
  
  - [x] 9.5 Write unit tests for error scenarios
    - Test duplicate product error
    - Test limit reached error
    - Test persistence failure handling
    - Test invalid share ID handling

- [x] 10. Integration and wiring
  - [x] 10.1 Wire ComparisonManager to persistence layer
    - Initialize with correct persistence strategy based on auth
    - Handle auth state changes
    - _Requirements: 5.4, 5.5_
  
  - [x] 10.2 Wire UI components to ComparisonManager
    - Connect ComparisonTable to manager
    - Connect ComparisonIndicator to manager
    - Connect add-to-compare buttons throughout app
    - _Requirements: 1.1, 2.1, 8.1, 8.2_
  
  - [x] 10.3 Implement navigation between comparison and browsing
    - Add route for comparison page
    - Implement back navigation from comparison
    - _Requirements: 8.2, 8.3_
  
  - [x] 10.4 Write integration tests
    - Test complete add-view-remove flow
    - Test persistence across page reloads
    - Test auth transition (anonymous to authenticated)
    - Test share and load shared comparison flow

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end user flows
