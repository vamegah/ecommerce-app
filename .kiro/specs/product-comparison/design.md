# Design Document: Product Comparison

## Overview

The Product Comparison feature provides a comprehensive system for users to compare multiple products side-by-side. The design emphasizes performance, usability, and persistence across both authenticated and anonymous user sessions.

The system consists of three main layers:
1. **Presentation Layer**: Comparison table UI with responsive design
2. **Business Logic Layer**: Comparison state management, validation, and persistence coordination
3. **Data Layer**: Persistence mechanisms for both authenticated (server-side) and anonymous (client-side) users

Key design decisions:
- Maximum 4 products per comparison (balances usability with screen real estate)
- Dual persistence strategy (local storage for anonymous, server storage for authenticated)
- Optimistic UI updates with background persistence
- Shareable comparison URLs with 30-day expiration

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Comparison   │  │  Product     │  │  Comparison  │      │
│  │    Table     │  │   Card       │  │  Indicator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Comparison Manager                           │   │
│  │  - Add/Remove Products                               │   │
│  │  - Validate Limits                                   │   │
│  │  - Generate Shareable URLs                           │   │
│  │  - Coordinate Persistence                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Local      │              │   Server     │            │
│  │   Storage    │              │   Storage    │            │
│  │  (Anonymous) │              │(Authenticated)│           │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Add Product Flow**:
   - User clicks "Add to Compare" on product
   - Comparison Manager validates against limit
   - If valid, product added to in-memory state
   - UI updates optimistically
   - Persistence layer saves asynchronously
   - Success/failure feedback provided

2. **Load Comparison Flow**:
   - User navigates to comparison page
   - Comparison Manager checks authentication status
   - Loads from appropriate persistence layer
   - Validates product availability
   - Renders comparison table

3. **Share Comparison Flow**:
   - User clicks "Share" button
   - Comparison Manager generates unique ID
   - Saves comparison snapshot to server
   - Returns shareable URL
   - User copies URL to clipboard

## Components and Interfaces

### ComparisonManager

Core business logic component managing comparison state and operations.

```typescript
interface ComparisonManager {
  // State management
  addProduct(productId: string): Promise<ComparisonResult>
  removeProduct(productId: string): Promise<ComparisonResult>
  getComparison(): Comparison
  clearComparison(): Promise<void>
  
  // Sharing
  generateShareableUrl(): Promise<string>
  loadSharedComparison(shareId: string): Promise<Comparison>
  
  // Validation
  canAddProduct(productId: string): ValidationResult
  isAtLimit(): boolean
}

interface ComparisonResult {
  success: boolean
  comparison: Comparison
  error?: ComparisonError
}

interface ValidationResult {
  valid: boolean
  reason?: string
}

enum ComparisonError {
  LIMIT_REACHED,
  DUPLICATE_PRODUCT,
  PRODUCT_NOT_FOUND,
  PERSISTENCE_FAILED
}
```

### Comparison Data Model

```typescript
interface Comparison {
  id: string
  products: Product[]
  createdAt: Date
  updatedAt: Date
  userId?: string  // Present for authenticated users
}

interface Product {
  id: string
  name: string
  price: number
  imageUrl: string
  attributes: ProductAttribute[]
  available: boolean
}

interface ProductAttribute {
  name: string
  value: string | number | boolean
  category: AttributeCategory
  type: AttributeType
}

enum AttributeCategory {
  SPECIFICATIONS,
  PRICING,
  FEATURES,
  SHIPPING,
  GENERAL
}

enum AttributeType {
  TEXT,
  NUMBER,
  BOOLEAN,
  CURRENCY,
  RATING
}
```

### PersistenceStrategy

Abstract interface for persistence with concrete implementations.

```typescript
interface PersistenceStrategy {
  save(comparison: Comparison): Promise<void>
  load(): Promise<Comparison | null>
  saveShared(comparison: Comparison): Promise<string>  // Returns share ID
  loadShared(shareId: string): Promise<Comparison | null>
}

class LocalStoragePersistence implements PersistenceStrategy {
  private readonly STORAGE_KEY = 'product_comparison'
  
  async save(comparison: Comparison): Promise<void>
  async load(): Promise<Comparison | null>
  async saveShared(comparison: Comparison): Promise<string>
  async loadShared(shareId: string): Promise<Comparison | null>
}

class ServerPersistence implements PersistenceStrategy {
  private readonly apiClient: ApiClient
  
  async save(comparison: Comparison): Promise<void>
  async load(): Promise<Comparison | null>
  async saveShared(comparison: Comparison): Promise<string>
  async loadShared(shareId: string): Promise<Comparison | null>
}
```

### ComparisonTable Component

UI component for rendering the comparison table.

```typescript
interface ComparisonTableProps {
  comparison: Comparison
  onRemoveProduct: (productId: string) => void
  onShare: () => void
}

interface ComparisonTableState {
  highlightDifferences: boolean
  expandedAttributes: Set<string>
}

class ComparisonTable {
  render(): ReactElement
  
  private renderProductColumn(product: Product): ReactElement
  private renderAttributeRow(attributeName: string): ReactElement
  private renderAttributeValue(attribute: ProductAttribute): ReactElement
  private highlightBestValue(attributeName: string, products: Product[]): void
  private groupAttributesByCategory(products: Product[]): Map<AttributeCategory, string[]>
}
```

### ComparisonIndicator Component

Persistent UI element showing comparison status.

```typescript
interface ComparisonIndicatorProps {
  productCount: number
  maxProducts: number
  onClick: () => void
}

class ComparisonIndicator {
  render(): ReactElement
}
```

## Data Models

### Storage Schema

**Local Storage (Anonymous Users)**:
```json
{
  "product_comparison": {
    "id": "local_<timestamp>",
    "products": ["prod_123", "prod_456"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:45:00Z"
  }
}
```

**Server Storage (Authenticated Users)**:
```sql
-- comparisons table
CREATE TABLE comparisons (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  INDEX idx_user_id (user_id)
);

-- comparison_products table
CREATE TABLE comparison_products (
  comparison_id UUID REFERENCES comparisons(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  position INTEGER NOT NULL,
  added_at TIMESTAMP NOT NULL,
  PRIMARY KEY (comparison_id, product_id)
);

-- shared_comparisons table
CREATE TABLE shared_comparisons (
  share_id VARCHAR(32) PRIMARY KEY,
  comparison_snapshot JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_expires_at (expires_at)
);
```

### Attribute Normalization

Different products may have different attribute sets. The system normalizes attributes for display:

```typescript
interface AttributeNormalization {
  // Collect all unique attributes across products
  collectAttributes(products: Product[]): string[]
  
  // Get attribute value for a product, or null if not present
  getAttributeValue(product: Product, attributeName: string): ProductAttribute | null
  
  // Determine display order for attributes
  sortAttributes(attributes: string[], category: AttributeCategory): string[]
}
```

Attribute display order:
1. Price (always first)
2. Rating (if present)
3. Key specifications (category-specific)
4. Features (alphabetically)
5. Shipping information
6. General attributes


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Product Addition Increases Comparison Size

*For any* comparison below the limit and any product not already in the comparison, adding the product should increase the comparison size by exactly one.

**Validates: Requirements 1.1**

### Property 2: Added Products Include All Attributes

*For any* product with a set of attributes, when added to a comparison, all of the product's attributes should be present in the comparison table.

**Validates: Requirements 1.2**

### Property 3: Adding Duplicate Products is Idempotent

*For any* comparison and any product already in that comparison, attempting to add the product again should result in the same comparison state (no duplicates, same size).

**Validates: Requirements 1.3**

### Property 4: Adding at Limit Fails Gracefully

*For any* comparison at the maximum limit (4 products), attempting to add another product should fail and return an error indicating the limit has been reached, while maintaining the current comparison state unchanged.

**Validates: Requirements 1.4, 6.2**

### Property 5: Modifications Persist Correctly

*For any* comparison and any modification (add or remove product), after persisting and reloading, the comparison should match the modified state.

**Validates: Requirements 1.5, 2.2**

### Property 6: Product Removal Decreases Comparison Size

*For any* comparison and any product in that comparison, removing the product should decrease the comparison size by exactly one and the product should no longer be present.

**Validates: Requirements 2.1**

### Property 7: Removal Preserves Order of Remaining Products

*For any* comparison with multiple products, removing any product should maintain the relative display order of all remaining products.

**Validates: Requirements 2.4**

### Property 8: Comparison Table Structure is Consistent

*For any* comparison, the rendered table should have products as columns with the first column containing attribute names and subsequent columns containing the corresponding attribute values for each product.

**Validates: Requirements 3.1, 3.2**

### Property 9: All Unique Attributes Are Displayed

*For any* set of products with varying attribute sets, the comparison table should display all unique attributes across all products, showing "N/A" or empty values for products missing specific attributes.

**Validates: Requirements 3.3**

### Property 10: Essential Product Information is Displayed

*For any* comparison, each product column should contain the product's image, name, and price at the top of the column.

**Validates: Requirements 3.5**

### Property 11: Best Numeric Values Are Highlighted

*For any* numeric attribute across multiple products, the best value (lowest for price/cost, highest for rating/score) should be identified and marked for highlighting.

**Validates: Requirements 4.1**

### Property 12: Boolean Attributes Render Consistently

*For any* boolean attribute value, it should always render with the same visual indicator (true values use the same icon, false values use the same icon).

**Validates: Requirements 4.2**

### Property 13: Long Text Attributes Are Handled

*For any* text attribute exceeding a length threshold, the system should either truncate with expansion capability or display the full text.

**Validates: Requirements 4.3**

### Property 14: Attributes Are Grouped by Category

*For any* set of attributes, they should be grouped by their category (specifications, pricing, features, etc.) in the comparison table.

**Validates: Requirements 4.4**

### Property 15: Comparison State Round-Trips Through Persistence

*For any* comparison, saving it to persistence and then loading it back should produce an equivalent comparison with the same products and attributes.

**Validates: Requirements 5.2**

### Property 16: Correct Persistence Strategy is Selected

*For any* user session, authenticated users should use server persistence while anonymous users should use local storage persistence.

**Validates: Requirements 5.4, 5.5**

### Property 17: Unavailable Products Are Marked

*For any* saved comparison where a product becomes unavailable, loading the comparison should mark that product as unavailable while retaining it in the comparison.

**Validates: Requirements 5.6**

### Property 18: Comparison Size Never Exceeds Limit

*For any* sequence of add and remove operations, the comparison should never contain more than 4 products.

**Validates: Requirements 6.1**

### Property 19: Limit Notification Contains Required Information

*For any* limit-reached error, the notification should contain both the current product count and the maximum limit value.

**Validates: Requirements 6.3**

### Property 20: Share URLs Are Unique

*For any* two different comparisons, generating shareable URLs should produce distinct URLs.

**Validates: Requirements 7.1**

### Property 21: Shared Comparisons Round-Trip Correctly

*For any* comparison, generating a shareable URL and then loading from that URL should produce an equivalent comparison with the same products and attributes.

**Validates: Requirements 7.2**

### Property 22: Comparison Indicator Shows Correct Count

*For any* comparison state, the comparison indicator should display the exact number of products currently in the comparison.

**Validates: Requirements 8.1**

### Property 23: Modification Feedback is Provided

*For any* product addition to the comparison, the system should provide visual feedback confirming the addition.

**Validates: Requirements 8.4**


## Error Handling

### Error Categories

**1. Validation Errors**
- Duplicate product addition
- Comparison limit exceeded
- Invalid product ID

**2. Persistence Errors**
- Local storage quota exceeded
- Server storage unavailable
- Network timeout

**3. Data Errors**
- Product not found
- Malformed comparison data
- Expired shared comparison

### Error Handling Strategy

```typescript
class ComparisonError extends Error {
  constructor(
    public code: ComparisonErrorCode,
    public message: string,
    public recoverable: boolean
  ) {
    super(message)
  }
}

enum ComparisonErrorCode {
  LIMIT_REACHED = 'LIMIT_REACHED',
  DUPLICATE_PRODUCT = 'DUPLICATE_PRODUCT',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PERSISTENCE_FAILED = 'PERSISTENCE_FAILED',
  INVALID_SHARE_ID = 'INVALID_SHARE_ID',
  SHARE_EXPIRED = 'SHARE_EXPIRED'
}
```

**Error Recovery**:
- **Validation errors**: Display user-friendly message, maintain current state
- **Persistence errors**: Retry with exponential backoff (3 attempts), fallback to in-memory only
- **Data errors**: Log error, display notification, attempt to recover partial data

**User Notifications**:
- Validation errors: Inline messages near action button
- Persistence errors: Toast notification with retry option
- Data errors: Modal dialog with explanation and recovery options

### Graceful Degradation

1. **Persistence Failure**: Continue with in-memory comparison, warn user data won't be saved
2. **Product Unavailable**: Show product as unavailable but keep in comparison for reference
3. **Attribute Missing**: Display "N/A" rather than breaking the table
4. **Image Load Failure**: Show placeholder image
5. **Share Service Down**: Disable share button with explanation

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs through randomization

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library**: fast-check (for TypeScript/JavaScript)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: product-comparison, Property {number}: {property_text}`
- Each correctness property implemented by a single property-based test

**Test Generators**:

```typescript
// Generate random products
const productArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  imageUrl: fc.webUrl(),
  attributes: fc.array(attributeArbitrary, { minLength: 1, maxLength: 20 }),
  available: fc.boolean()
})

// Generate random attributes
const attributeArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  value: fc.oneof(
    fc.string(),
    fc.double({ noNaN: true }),
    fc.boolean()
  ),
  category: fc.constantFrom(...Object.values(AttributeCategory)),
  type: fc.constantFrom(...Object.values(AttributeType))
})

// Generate random comparisons
const comparisonArbitrary = fc.record({
  id: fc.uuid(),
  products: fc.array(productArbitrary, { minLength: 0, maxLength: 4 }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
  userId: fc.option(fc.uuid())
})
```

**Example Property Test**:

```typescript
// Feature: product-comparison, Property 1: Product Addition Increases Comparison Size
test('adding product increases comparison size by one', () => {
  fc.assert(
    fc.property(
      comparisonArbitrary.filter(c => c.products.length < 4),
      productArbitrary,
      (comparison, product) => {
        // Ensure product not already in comparison
        fc.pre(!comparison.products.some(p => p.id === product.id))
        
        const initialSize = comparison.products.length
        const result = comparisonManager.addProduct(comparison, product)
        
        expect(result.products.length).toBe(initialSize + 1)
        expect(result.products).toContainEqual(product)
      }
    ),
    { numRuns: 100 }
  )
})
```

### Unit Testing

**Focus Areas**:
1. **Edge Cases**:
   - Empty comparison state
   - Single product comparison
   - Comparison at maximum limit
   - All products removed

2. **Error Conditions**:
   - Adding duplicate product
   - Adding when at limit
   - Removing non-existent product
   - Loading expired shared comparison
   - Persistence failures

3. **Integration Points**:
   - Persistence strategy selection
   - Authentication state changes
   - Product availability changes
   - Share URL generation

**Example Unit Tests**:

```typescript
describe('ComparisonManager', () => {
  describe('edge cases', () => {
    test('empty comparison displays instructions', () => {
      const comparison = createEmptyComparison()
      const rendered = renderComparison(comparison)
      expect(rendered).toContain('Add products to compare')
    })
    
    test('removing last product shows empty state', () => {
      const comparison = createComparisonWithProducts([product1])
      const result = comparisonManager.removeProduct(comparison, product1.id)
      expect(result.products).toHaveLength(0)
    })
  })
  
  describe('error handling', () => {
    test('adding duplicate returns error', () => {
      const comparison = createComparisonWithProducts([product1])
      const result = comparisonManager.addProduct(comparison, product1)
      expect(result.success).toBe(false)
      expect(result.error).toBe(ComparisonError.DUPLICATE_PRODUCT)
    })
    
    test('adding at limit returns error', () => {
      const comparison = createComparisonWithProducts([p1, p2, p3, p4])
      const result = comparisonManager.addProduct(comparison, p5)
      expect(result.success).toBe(false)
      expect(result.error).toBe(ComparisonError.LIMIT_REACHED)
    })
  })
})
```

### Integration Testing

**Scenarios**:
1. Complete user flow: Browse → Add to compare → View comparison → Remove product → Share
2. Persistence across sessions: Add products → Close browser → Reopen → Verify comparison restored
3. Authentication transition: Start anonymous → Add products → Login → Verify migration to server storage
4. Product availability: Save comparison → Product becomes unavailable → Load comparison → Verify marked unavailable

### Performance Testing

**Benchmarks**:
- Comparison table render: < 100ms for 4 products with 50 attributes each
- Add/remove product: < 50ms
- Persistence save: < 500ms
- Load from persistence: < 200ms
- Share URL generation: < 1000ms

**Load Testing**:
- Concurrent users: 1000 simultaneous comparisons
- Storage: 10,000 saved comparisons per user
- Shared comparisons: 100,000 active shared URLs

