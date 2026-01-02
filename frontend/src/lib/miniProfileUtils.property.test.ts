import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  truncateBio,
  calculateMiniProfilePosition,
  isValidImageFile,
  isValidHexColor,
  computeMutualFriendsDisplay,
  type MutualFriend,
} from './miniProfileUtils';

/**
 * Property 1: Viewport Boundary Positioning
 * 
 * For any trigger element position, mini-profile dimensions, and viewport dimensions, 
 * the calculated mini-profile position SHALL result in the mini-profile being fully 
 * contained within the visible viewport boundaries.
 * 
 * **Validates: Requirements 1.6**
 */
describe('calculateMiniProfilePosition - Property 1: Viewport Boundary Positioning', () => {
  // Arbitrary for generating a valid DOMRect-like object with consistent values
  // Using integers to avoid floating-point precision issues
  const domRectArb = fc.tuple(
    fc.integer({ min: 0, max: 1500 }),  // left/x
    fc.integer({ min: 0, max: 1500 }),  // top/y
    fc.integer({ min: 10, max: 500 }),  // width
    fc.integer({ min: 10, max: 200 })   // height
  ).map(([left, top, width, height]) => ({
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }));

  // Arbitrary for profile dimensions
  const profileDimensionsArb = fc.record({
    width: fc.integer({ min: 100, max: 400 }),
    height: fc.integer({ min: 100, max: 300 }),
  });

  // Arbitrary for viewport dimensions (must be larger than profile)
  const viewportDimensionsArb = fc.record({
    width: fc.integer({ min: 400, max: 2000 }),
    height: fc.integer({ min: 400, max: 2000 }),
  });

  it('returned position keeps profile within viewport bounds', () => {
    fc.assert(
      fc.property(
        domRectArb,
        profileDimensionsArb,
        viewportDimensionsArb,
        (trigger, profile, viewport) => {
          // Ensure viewport is large enough to contain the profile
          fc.pre(viewport.width >= profile.width);
          fc.pre(viewport.height >= profile.height);

          const position = calculateMiniProfilePosition(
            trigger as DOMRect,
            profile,
            viewport
          );

          // Profile should be fully within viewport
          expect(position.x).toBeGreaterThanOrEqual(0);
          expect(position.y).toBeGreaterThanOrEqual(0);
          expect(position.x + profile.width).toBeLessThanOrEqual(viewport.width);
          expect(position.y + profile.height).toBeLessThanOrEqual(viewport.height);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position x is never negative', () => {
    fc.assert(
      fc.property(
        domRectArb,
        profileDimensionsArb,
        viewportDimensionsArb,
        (trigger, profile, viewport) => {
          fc.pre(viewport.width >= profile.width);
          fc.pre(viewport.height >= profile.height);

          const position = calculateMiniProfilePosition(
            trigger as DOMRect,
            profile,
            viewport
          );

          expect(position.x).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position y is never negative', () => {
    fc.assert(
      fc.property(
        domRectArb,
        profileDimensionsArb,
        viewportDimensionsArb,
        (trigger, profile, viewport) => {
          fc.pre(viewport.width >= profile.width);
          fc.pre(viewport.height >= profile.height);

          const position = calculateMiniProfilePosition(
            trigger as DOMRect,
            profile,
            viewport
          );

          expect(position.y).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Bio Truncation Consistency
 * 
 * For any bio string, the truncateBio function SHALL return the original string 
 * if length ≤ maxLength, otherwise return the first maxLength characters followed by "...".
 * 
 * **Validates: Requirements 3.3**
 */
describe('truncateBio - Property 3: Bio Truncation Consistency', () => {
  it('returns original string when length <= maxLength', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 150 }),
        fc.integer({ min: 1, max: 500 }),
        (bio, maxLength) => {
          // Only test when bio length is <= maxLength
          fc.pre(bio.length <= maxLength);
          
          const result = truncateBio(bio, maxLength);
          expect(result).toBe(bio);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncates with "..." when length > maxLength', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 500 }),
        (bio, maxLength) => {
          // Only test when bio length is > maxLength
          fc.pre(bio.length > maxLength);
          
          const result = truncateBio(bio, maxLength);
          
          // Result should be maxLength chars + "..."
          expect(result.length).toBe(maxLength + 3);
          expect(result.endsWith('...')).toBe(true);
          expect(result.slice(0, maxLength)).toBe(bio.slice(0, maxLength));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uses default maxLength of 150 when not specified', () => {
    fc.assert(
      fc.property(fc.string(), (bio) => {
        const result = truncateBio(bio);
        
        if (bio.length <= 150) {
          expect(result).toBe(bio);
        } else {
          expect(result.length).toBe(153); // 150 + "..."
          expect(result.endsWith('...')).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 6: Image Validation
 * 
 * For any file with MIME type M and size S bytes, the validation function SHALL return 
 * true if and only if M is in ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] 
 * AND S ≤ 5,242,880 (5MB).
 * 
 * **Validates: Requirements 6.3**
 */
describe('isValidImageFile - Property 6: Image Validation', () => {
  const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  // Arbitrary for valid MIME types
  const validTypeArb = fc.constantFrom(...VALID_TYPES);

  // Arbitrary for invalid MIME types
  const invalidTypeArb = fc.string().filter(s => !VALID_TYPES.includes(s));

  // Arbitrary for valid file sizes (0 to 5MB)
  const validSizeArb = fc.integer({ min: 0, max: MAX_SIZE });

  // Arbitrary for invalid file sizes (> 5MB)
  const invalidSizeArb = fc.integer({ min: MAX_SIZE + 1, max: MAX_SIZE * 10 });

  it('returns true for valid type AND valid size', () => {
    fc.assert(
      fc.property(validTypeArb, validSizeArb, (type, size) => {
        expect(isValidImageFile(type, size)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('returns false for invalid type regardless of size', () => {
    fc.assert(
      fc.property(invalidTypeArb, fc.integer({ min: 0, max: MAX_SIZE * 10 }), (type, size) => {
        expect(isValidImageFile(type, size)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('returns false for valid type but invalid size', () => {
    fc.assert(
      fc.property(validTypeArb, invalidSizeArb, (type, size) => {
        expect(isValidImageFile(type, size)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('returns false for invalid type AND invalid size', () => {
    fc.assert(
      fc.property(invalidTypeArb, invalidSizeArb, (type, size) => {
        expect(isValidImageFile(type, size)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Hex Color Validation
 * 
 * For any string input, the color validation function SHALL return true if and only 
 * if the string matches the pattern /^#[0-9A-Fa-f]{6}$/.
 * 
 * **Validates: Requirements 2.3**
 */
describe('isValidHexColor - Property 7: Hex Color Validation', () => {
  // Arbitrary for valid hex color strings
  const validHexColorArb = fc
    .array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 6, maxLength: 6 })
    .map(chars => '#' + chars.join(''));

  // Arbitrary for invalid hex colors (wrong length, missing #, invalid chars)
  const invalidHexColorArb = fc.oneof(
    // Missing # prefix
    fc.array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 6, maxLength: 6 })
      .map(chars => chars.join('')),
    // Wrong length (too short)
    fc.array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 1, maxLength: 5 })
      .map(chars => '#' + chars.join('')),
    // Wrong length (too long)
    fc.array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 7, maxLength: 10 })
      .map(chars => '#' + chars.join('')),
    // Invalid characters
    fc.string({ minLength: 1, maxLength: 10 }).filter(s => !/^#[0-9A-Fa-f]{6}$/.test(s))
  );

  it('returns true for valid hex colors', () => {
    fc.assert(
      fc.property(validHexColorArb, (color) => {
        expect(isValidHexColor(color)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('returns false for invalid hex colors', () => {
    fc.assert(
      fc.property(invalidHexColorArb, (color) => {
        expect(isValidHexColor(color)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('validates specific known valid colors', () => {
    const validColors = ['#000000', '#FFFFFF', '#ffffff', '#123456', '#AbCdEf', '#aabbcc'];
    for (const color of validColors) {
      expect(isValidHexColor(color)).toBe(true);
    }
  });

  it('rejects specific known invalid colors', () => {
    const invalidColors = ['000000', '#fff', '#GGGGGG', '#12345', '#1234567', '', '#', 'red'];
    for (const color of invalidColors) {
      expect(isValidHexColor(color)).toBe(false);
    }
  });
});


/**
 * Property 4: Mutual Friends Display Rules
 * 
 * For any array of mutual friends with length N:
 * - If N = 0, the section is hidden
 * - If 1 ≤ N ≤ 3, exactly N avatars are displayed
 * - If N > 3, exactly 3 avatars are displayed plus a "+{N-3} more" indicator
 * 
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */
describe('computeMutualFriendsDisplay - Property 4: Mutual Friends Display Rules', () => {
  // Arbitrary for generating a MutualFriend object
  const mutualFriendArb: fc.Arbitrary<MutualFriend> = fc.record({
    id: fc.uuid(),
    username: fc.string({ minLength: 1, maxLength: 32 }),
    avatar: fc.option(fc.webUrl(), { nil: null }),
  });

  // Arbitrary for generating an array of mutual friends
  const mutualFriendsArrayArb = fc.array(mutualFriendArb, { minLength: 0, maxLength: 50 });

  it('hides section when no mutual friends (N = 0)', () => {
    const result = computeMutualFriendsDisplay([]);
    
    expect(result.showSection).toBe(false);
    expect(result.displayedFriends).toHaveLength(0);
    expect(result.extraCount).toBe(0);
    expect(result.moreIndicator).toBeNull();
  });

  it('displays exactly N avatars when 1 ≤ N ≤ 3', () => {
    fc.assert(
      fc.property(
        fc.array(mutualFriendArb, { minLength: 1, maxLength: 3 }),
        (friends) => {
          const result = computeMutualFriendsDisplay(friends);
          
          expect(result.showSection).toBe(true);
          expect(result.displayedFriends).toHaveLength(friends.length);
          expect(result.extraCount).toBe(0);
          expect(result.moreIndicator).toBeNull();
          
          // Verify displayed friends are the same as input
          for (let i = 0; i < friends.length; i++) {
            expect(result.displayedFriends[i]).toEqual(friends[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('displays exactly 3 avatars plus "+N more" indicator when N > 3', () => {
    fc.assert(
      fc.property(
        fc.array(mutualFriendArb, { minLength: 4, maxLength: 50 }),
        (friends) => {
          const result = computeMutualFriendsDisplay(friends);
          
          expect(result.showSection).toBe(true);
          expect(result.displayedFriends).toHaveLength(3);
          expect(result.extraCount).toBe(friends.length - 3);
          expect(result.moreIndicator).toBe(`+${friends.length - 3} more`);
          
          // Verify displayed friends are the first 3
          for (let i = 0; i < 3; i++) {
            expect(result.displayedFriends[i]).toEqual(friends[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('showSection is true if and only if N > 0', () => {
    fc.assert(
      fc.property(mutualFriendsArrayArb, (friends) => {
        const result = computeMutualFriendsDisplay(friends);
        
        if (friends.length === 0) {
          expect(result.showSection).toBe(false);
        } else {
          expect(result.showSection).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('displayedFriends length is min(N, 3)', () => {
    fc.assert(
      fc.property(mutualFriendsArrayArb, (friends) => {
        const result = computeMutualFriendsDisplay(friends);
        const expectedLength = Math.min(friends.length, 3);
        
        expect(result.displayedFriends).toHaveLength(expectedLength);
      }),
      { numRuns: 100 }
    );
  });

  it('extraCount is max(0, N - 3)', () => {
    fc.assert(
      fc.property(mutualFriendsArrayArb, (friends) => {
        const result = computeMutualFriendsDisplay(friends);
        const expectedExtra = Math.max(0, friends.length - 3);
        
        expect(result.extraCount).toBe(expectedExtra);
      }),
      { numRuns: 100 }
    );
  });

  it('moreIndicator is null when N ≤ 3, otherwise "+{N-3} more"', () => {
    fc.assert(
      fc.property(mutualFriendsArrayArb, (friends) => {
        const result = computeMutualFriendsDisplay(friends);
        
        if (friends.length <= 3) {
          expect(result.moreIndicator).toBeNull();
        } else {
          expect(result.moreIndicator).toBe(`+${friends.length - 3} more`);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 2: Customization Persistence Round-Trip
 * 
 * For any valid mini-profile customization settings (background URL, font name, hex color), 
 * serializing to JSON then deserializing SHALL produce an equivalent settings object.
 * 
 * **Validates: Requirements 2.4**
 */
describe('MiniProfileCustomization - Property 2: Customization Persistence Round-Trip', () => {
  // Interface for mini-profile customization settings
  interface MiniProfileCustomization {
    backgroundImage: string | null;
    usernameFont: string;
    textColor: string;
  }

  // Available Google Fonts (matching the component's font options)
  const FONT_OPTIONS = [
    'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Playfair Display',
    'Merriweather', 'Pacifico', 'Dancing Script', 'Bebas Neue',
    'Permanent Marker', 'Fira Code', 'JetBrains Mono'
  ];

  // Arbitrary for valid hex colors
  const validHexColorArb = fc
    .array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 6, maxLength: 6 })
    .map(chars => '#' + chars.join(''));

  // Arbitrary for valid font names
  const validFontArb = fc.constantFrom(...FONT_OPTIONS);

  // Arbitrary for background image (URL or base64 data URL, or null)
  const backgroundImageArb = fc.oneof(
    fc.constant(null),
    fc.webUrl(),
    // Simulate base64 data URL
    fc.string({ minLength: 10, maxLength: 100 }).map(s => `data:image/png;base64,${Buffer.from(s).toString('base64')}`)
  );

  // Arbitrary for valid MiniProfileCustomization
  const miniProfileCustomizationArb: fc.Arbitrary<MiniProfileCustomization> = fc.record({
    backgroundImage: backgroundImageArb,
    usernameFont: validFontArb,
    textColor: validHexColorArb,
  });

  it('JSON serialization round-trip produces equivalent object', () => {
    fc.assert(
      fc.property(miniProfileCustomizationArb, (settings) => {
        // Serialize to JSON
        const serialized = JSON.stringify(settings);
        
        // Deserialize from JSON
        const deserialized = JSON.parse(serialized) as MiniProfileCustomization;
        
        // Verify equivalence
        expect(deserialized.backgroundImage).toBe(settings.backgroundImage);
        expect(deserialized.usernameFont).toBe(settings.usernameFont);
        expect(deserialized.textColor).toBe(settings.textColor);
        
        // Deep equality check
        expect(deserialized).toEqual(settings);
      }),
      { numRuns: 100 }
    );
  });

  it('settings with null backgroundImage serialize correctly', () => {
    fc.assert(
      fc.property(validFontArb, validHexColorArb, (font, color) => {
        const settings: MiniProfileCustomization = {
          backgroundImage: null,
          usernameFont: font,
          textColor: color,
        };
        
        const serialized = JSON.stringify(settings);
        const deserialized = JSON.parse(serialized) as MiniProfileCustomization;
        
        expect(deserialized.backgroundImage).toBeNull();
        expect(deserialized.usernameFont).toBe(font);
        expect(deserialized.textColor).toBe(color);
      }),
      { numRuns: 100 }
    );
  });

  it('settings with URL backgroundImage serialize correctly', () => {
    fc.assert(
      fc.property(fc.webUrl(), validFontArb, validHexColorArb, (url, font, color) => {
        const settings: MiniProfileCustomization = {
          backgroundImage: url,
          usernameFont: font,
          textColor: color,
        };
        
        const serialized = JSON.stringify(settings);
        const deserialized = JSON.parse(serialized) as MiniProfileCustomization;
        
        expect(deserialized.backgroundImage).toBe(url);
        expect(deserialized.usernameFont).toBe(font);
        expect(deserialized.textColor).toBe(color);
      }),
      { numRuns: 100 }
    );
  });

  it('all font options are valid for serialization', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FONT_OPTIONS),
        backgroundImageArb,
        validHexColorArb,
        (font, bg, color) => {
          const settings: MiniProfileCustomization = {
            backgroundImage: bg,
            usernameFont: font,
            textColor: color,
          };
          
          const serialized = JSON.stringify(settings);
          const deserialized = JSON.parse(serialized) as MiniProfileCustomization;
          
          expect(deserialized.usernameFont).toBe(font);
          expect(FONT_OPTIONS).toContain(deserialized.usernameFont);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hex colors preserve case through serialization', () => {
    fc.assert(
      fc.property(validHexColorArb, (color) => {
        const settings: MiniProfileCustomization = {
          backgroundImage: null,
          usernameFont: 'Inter',
          textColor: color,
        };
        
        const serialized = JSON.stringify(settings);
        const deserialized = JSON.parse(serialized) as MiniProfileCustomization;
        
        // Color should be exactly preserved (including case)
        expect(deserialized.textColor).toBe(color);
        // And should still be a valid hex color
        expect(isValidHexColor(deserialized.textColor)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
