<!--
  Test fixture for lilmd integration tests.

  This file is a concatenation of 8 MDN Web Docs pages under
  files/en-us/web/javascript/reference/global_objects/array from the
  mdn/content repository. Each source file is hoisted under a synthetic
  H1 so the fixture has a well-defined heading tree.

  Source:  https://github.com/mdn/content
  License: CC BY-SA 2.5 (https://creativecommons.org/licenses/by-sa/2.5/)
  Author:  Mozilla Contributors

  Unmodified aside from front-matter stripping and the synthetic H1
  wrappers. Regenerate with the short shell recipe in BENCHMARK.md.
-->

# Array.prototype.array


The **`Array()`** constructor creates {{jsxref("Array")}} objects.

## Syntax

```js-nolint
new Array()
new Array(element1)
new Array(element1, element2)
new Array(element1, element2, /* …, */ elementN)
new Array(arrayLength)

Array()
Array(element1)
Array(element1, element2)
Array(element1, element2, /* …, */ elementN)
Array(arrayLength)
```

> [!NOTE]
> `Array()` can be called with or without [`new`](/en-US/docs/Web/JavaScript/Reference/Operators/new). Both create a new `Array` instance.

### Parameters

- `element1`, …, `elementN`
  - : A JavaScript array is initialized with the given elements, except in the case where
    a single argument is passed to the `Array` constructor and that argument is
    a number (see the `arrayLength` parameter below). Note that this special case only
    applies to JavaScript arrays created with the `Array` constructor, not
    array literals created with the square bracket syntax.
- `arrayLength`
  - : If the only argument passed to the `Array` constructor is an integer
    between 0 and 2<sup>32</sup> - 1 (inclusive), this returns a new JavaScript array with
    its `length` property set to that number.

    > [!NOTE]
    > This implies an array of `arrayLength` empty slots, not slots with actual `undefined` values — see [sparse arrays](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays)).

### Exceptions

- {{jsxref("RangeError")}}
  - : Thrown if there's only one argument (`arrayLength`) that is a number, but its value is not an integer or not between 0 and 2<sup>32</sup> - 1 (inclusive).

## Examples

### Array literal notation

Arrays can be created using the [literal](/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#array_literals)
notation:

```js
const fruits = ["Apple", "Banana"];

console.log(fruits.length); // 2
console.log(fruits[0]); // "Apple"
```

### Array constructor with a single parameter

Arrays can be created using a constructor with a single number parameter. An array is created with
its `length` property set to that number, and the array elements are empty
slots.

```js
const arrayEmpty = new Array(2);

console.log(arrayEmpty.length); // 2
console.log(arrayEmpty[0]); // undefined; actually, it is an empty slot
console.log(0 in arrayEmpty); // false
console.log(1 in arrayEmpty); // false
```

```js
const arrayOfOne = new Array("2"); // Not the number 2 but the string "2"

console.log(arrayOfOne.length); // 1
console.log(arrayOfOne[0]); // "2"
```

### Array constructor with multiple parameters

If more than one argument is passed to the constructor, a new {{jsxref("Array")}} with
the given elements is created.

```js
const fruits = new Array("Apple", "Banana");

console.log(fruits.length); // 2
console.log(fruits[0]); // "Apple"
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}

# Array.prototype.at


The **`at()`** method of {{jsxref("Array")}} instances takes an integer value and returns the item at that index, allowing for positive and negative integers. Negative integers count back from the last item in the array.

{{InteractiveExample("JavaScript Demo: Array.prototype.at()")}}

```js interactive-example
const array = [5, 12, 8, 130, 44];

let index = 2;

console.log(`An index of ${index} returns ${array.at(index)}`);
// Expected output: "An index of 2 returns 8"

index = -2;

console.log(`An index of ${index} returns ${array.at(index)}`);
// Expected output: "An index of -2 returns 130"
```

## Syntax

```js-nolint
at(index)
```

### Parameters

- `index`
  - : Zero-based index of the array element to be returned, [converted to an integer](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#integer_conversion). Negative index counts back from the end of the array — if `index < 0`, `index + array.length` is accessed.

### Return value

The element in the array matching the given index. Always returns {{jsxref("undefined")}} if `index < -array.length` or `index >= array.length` without attempting to access the corresponding property.

## Description

The `at()` method is equivalent to the bracket notation when `index` is a non-negative integer. For example, `array[0]` and `array.at(0)` both return the first item. However, when counting elements from the end of the array, you cannot use `array[-1]` like you may in Python or R, because all values inside the square brackets are treated literally as string properties, so you will end up reading `array["-1"]`, which is just a normal string property instead of an array index.

The usual practice is to access {{jsxref("Array/length", "length")}} and calculate the index from that — for example, `array[array.length - 1]`. The `at()` method allows relative indexing, so this can be shortened to `array.at(-1)`.

By combining `at()` with {{jsxref("Array/with", "with()")}}, you can both read and write (respectively) an array using negative indices.

The `at()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). It only expects the `this` value to have a `length` property and integer-keyed properties.

## Examples

### Return the last value of an array

The following example provides a function which returns the last element found in a specified array.

```js
// Our array with items
const cart = ["apple", "banana", "pear"];

// A function which returns the last item of a given array
function returnLast(arr) {
  return arr.at(-1);
}

// Get the last item of our array 'cart'
const item1 = returnLast(cart);
console.log(item1); // 'pear'

// Add an item to our 'cart' array
cart.push("orange");
const item2 = returnLast(cart);
console.log(item2); // 'orange'
```

### Comparing methods

This example compares different ways to select the penultimate (last but one) item of an {{jsxref("Array")}}. While all the methods shown below are valid, this example highlights the succinctness and readability of the `at()` method.

```js
// Our array with items
const colors = ["red", "green", "blue"];

// Using length property
const lengthWay = colors[colors.length - 2];
console.log(lengthWay); // 'green'

// Using slice() method. Note an array is returned
const sliceWay = colors.slice(-2, -1);
console.log(sliceWay[0]); // 'green'

// Using at() method
const atWay = colors.at(-2);
console.log(atWay); // 'green'
```

### Calling at() on non-array objects

The `at()` method reads the `length` property of `this` and calculates the index to access.

```js
const arrayLike = {
  length: 2,
  0: "a",
  1: "b",
  2: "c", // ignored by at() since length is 2
};
console.log(Array.prototype.at.call(arrayLike, 0)); // "a"
console.log(Array.prototype.at.call(arrayLike, 2)); // undefined
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.at` in `core-js`](https://github.com/zloirock/core-js#relative-indexing-method)
- [es-shims polyfill of `Array.prototype.at`](https://www.npmjs.com/package/array.prototype.at)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.findIndex()")}}
- {{jsxref("Array.prototype.indexOf()")}}
- {{jsxref("Array.prototype.with()")}}
- {{jsxref("TypedArray.prototype.at()")}}
- {{jsxref("String.prototype.at()")}}

# Array.prototype.concat


The **`concat()`** method of {{jsxref("Array")}} instances is used to merge two or more arrays.
This method does not change the existing arrays, but instead returns a new array.

{{InteractiveExample("JavaScript Demo: Array.prototype.concat()", "shorter")}}

```js interactive-example
const array1 = ["a", "b", "c"];
const array2 = ["d", "e", "f"];
const array3 = array1.concat(array2);

console.log(array3);
// Expected output: Array ["a", "b", "c", "d", "e", "f"]
```

## Syntax

```js-nolint
concat()
concat(value1)
concat(value1, value2)
concat(value1, value2, /* …, */ valueN)
```

### Parameters

- `value1`, …, `valueN` {{optional_inline}}
  - : Arrays and/or values to concatenate into a new array. If all
    `valueN` parameters are omitted, `concat` returns a
    [shallow copy](/en-US/docs/Glossary/Shallow_copy) of the existing array on which it is called. See the description below
    for more details.

### Return value

A new {{jsxref("Array")}} instance.

## Description

The `concat` method creates a new array. The array will first be populated by the elements in the object on which it is called. Then, for each argument, its value will be concatenated into the array — for normal objects or primitives, the argument itself will become an element of the final array; for arrays or array-like objects with the property [`Symbol.isConcatSpreadable`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable) set to a truthy value, each element of the argument will be independently added to the final array. The `concat` method does not recurse into nested array arguments.

The `concat()` method is a [copying method](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods). It does not alter `this` or any of the arrays provided as arguments but instead returns a [shallow copy](/en-US/docs/Glossary/Shallow_copy) that contains the same elements as the ones from the original arrays.

The `concat()` method preserves empty slots if any of the source arrays is [sparse](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays).

The `concat()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). The `this` value is treated in the same way as the other arguments (except it will be converted to an object first), which means plain objects will be directly prepended to the resulting array, while array-like objects with truthy `[Symbol.isConcatSpreadable]` will be spread into the resulting array.

## Examples

### Concatenating two arrays

The following code concatenates two arrays:

```js
const letters = ["a", "b", "c"];
const numbers = [1, 2, 3];

const alphaNumeric = letters.concat(numbers);
console.log(alphaNumeric);
// results in ['a', 'b', 'c', 1, 2, 3]
```

### Concatenating three arrays

The following code concatenates three arrays:

```js
const num1 = [1, 2, 3];
const num2 = [4, 5, 6];
const num3 = [7, 8, 9];

const numbers = num1.concat(num2, num3);

console.log(numbers);
// results in [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

### Concatenating values to an array

The following code concatenates three values to an array:

```js
const letters = ["a", "b", "c"];

const alphaNumeric = letters.concat(1, [2, 3]);

console.log(alphaNumeric);
// results in ['a', 'b', 'c', 1, 2, 3]
```

### Concatenating nested arrays

The following code concatenates nested arrays and demonstrates retention of references:

```js
const num1 = [[1]];
const num2 = [2, [3]];

const numbers = num1.concat(num2);

console.log(numbers);
// results in [[1], 2, [3]]

// modify the first element of num1
num1[0].push(4);

console.log(numbers);
// results in [[1, 4], 2, [3]]
```

### Concatenating array-like objects with Symbol.isConcatSpreadable

`concat` does not treat all array-like objects as arrays by default — only if `Symbol.isConcatSpreadable` is set to a truthy value (e.g., `true`).

```js
const obj1 = { 0: 1, 1: 2, 2: 3, length: 3 };
const obj2 = { 0: 1, 1: 2, 2: 3, length: 3, [Symbol.isConcatSpreadable]: true };
console.log([0].concat(obj1, obj2));
// [ 0, { '0': 1, '1': 2, '2': 3, length: 3 }, 1, 2, 3 ]
```

### Using concat() on sparse arrays

If any of the source arrays is sparse, the resulting array will also be sparse:

```js
console.log([1, , 3].concat([4, 5])); // [1, empty, 3, 4, 5]
console.log([1, 2].concat([3, , 5])); // [1, 2, 3, empty, 5]
```

### Calling concat() on non-array objects

If the `this` value is not an array, it is converted to an object and then treated in the same way as the arguments for `concat()`. In this case the return value is always a plain new array.

```js
console.log(Array.prototype.concat.call({}, 1, 2, 3)); // [{}, 1, 2, 3]
console.log(Array.prototype.concat.call(1, 2, 3)); // [ [Number: 1], 2, 3 ]
const arrayLike = {
  [Symbol.isConcatSpreadable]: true,
  length: 2,
  0: 1,
  1: 2,
  2: 99, // ignored by concat() since length is 2
};
console.log(Array.prototype.concat.call(arrayLike, 3, 4)); // [1, 2, 3, 4]
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.concat` in `core-js` with fixes and implementation of modern behavior like `Symbol.isConcatSpreadable` support](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.prototype.concat`](https://www.npmjs.com/package/array.prototype.concat)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.push()")}}
- {{jsxref("Array.prototype.unshift()")}}
- {{jsxref("Array.prototype.splice()")}}
- {{jsxref("String.prototype.concat()")}}
- {{jsxref("Symbol.isConcatSpreadable")}}

# Array.prototype.entries


The **`entries()`** method of {{jsxref("Array")}} instances returns a new _[array iterator](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator)_ object that contains the key/value pairs for each index in the array.

{{InteractiveExample("JavaScript Demo: Array.prototype.entries()")}}

```js interactive-example
const array = ["a", "b", "c"];

const iterator = array.entries();

console.log(iterator.next().value);
// Expected output: Array [0, "a"]

console.log(iterator.next().value);
// Expected output: Array [1, "b"]
```

## Syntax

```js-nolint
entries()
```

### Parameters

None.

### Return value

A new [iterable iterator object](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator).

## Description

When used on [sparse arrays](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays), the `entries()` method iterates empty slots as if they have the value `undefined`.

The `entries()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). It only expects the `this` value to have a `length` property and integer-keyed properties.

## Examples

### Iterating with index and element

```js
const a = ["a", "b", "c"];

for (const [index, element] of a.entries()) {
  console.log(index, element);
}

// 0 'a'
// 1 'b'
// 2 'c'
```

### Using a for...of loop

```js
const array = ["a", "b", "c"];
const arrayEntries = array.entries();

for (const element of arrayEntries) {
  console.log(element);
}

// [0, 'a']
// [1, 'b']
// [2, 'c']
```

### Iterating sparse arrays

`entries()` will visit empty slots as if they are `undefined`.

```js
for (const element of [, "a"].entries()) {
  console.log(element);
}
// [0, undefined]
// [1, 'a']
```

### Calling entries() on non-array objects

The `entries()` method reads the `length` property of `this` and then accesses each property whose key is a nonnegative integer less than `length`.

```js
const arrayLike = {
  length: 3,
  0: "a",
  1: "b",
  2: "c",
  3: "d", // ignored by entries() since length is 3
};
for (const entry of Array.prototype.entries.call(arrayLike)) {
  console.log(entry);
}
// [ 0, 'a' ]
// [ 1, 'b' ]
// [ 2, 'c' ]
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.entries` in `core-js`](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.prototype.entries`](https://www.npmjs.com/package/array.prototype.entries)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.keys()")}}
- {{jsxref("Array.prototype.values()")}}
- [`Array.prototype[Symbol.iterator]()`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Symbol.iterator)
- {{jsxref("TypedArray.prototype.entries()")}}
- [Iteration protocols](/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)

# Array.prototype.filter


The **`filter()`** method of {{jsxref("Array")}} instances creates a [shallow copy](/en-US/docs/Glossary/Shallow_copy) of a portion of a given array, filtered down to just the elements from the given array that pass the test implemented by the provided function.

{{InteractiveExample("JavaScript Demo: Array.prototype.filter()", "shorter")}}

```js interactive-example
const words = ["spray", "elite", "exuberant", "destruction", "present"];

const result = words.filter((word) => word.length > 6);

console.log(result);
// Expected output: Array ["exuberant", "destruction", "present"]
```

## Syntax

```js-nolint
filter(callbackFn)
filter(callbackFn, thisArg)
```

### Parameters

- `callbackFn`
  - : A function to execute for each element in the array. It should return a [truthy](/en-US/docs/Glossary/Truthy) value to keep the element in the resulting array, and a [falsy](/en-US/docs/Glossary/Falsy) value otherwise. The function is called with the following arguments:
    - `element`
      - : The current element being processed in the array.
    - `index`
      - : The index of the current element being processed in the array.
    - `array`
      - : The array `filter()` was called upon.
- `thisArg` {{optional_inline}}
  - : A value to use as `this` when executing `callbackFn`. See [iterative methods](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods).

### Return value

A [shallow copy](/en-US/docs/Glossary/Shallow_copy) of the given array containing just the elements that pass the test. If no elements pass the test, an empty array is returned.

## Description

The `filter()` method is an [iterative method](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods). It calls a provided `callbackFn` function once for each element in an array, and constructs a new array of all the values for which `callbackFn` returns a [truthy](/en-US/docs/Glossary/Truthy) value. Array elements which do not pass the `callbackFn` test are not included in the new array. Read the [iterative methods](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods) section for more information about how these methods work in general.

`callbackFn` is invoked only for array indexes which have assigned values. It is not invoked for empty slots in [sparse arrays](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays).

The `filter()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). It only expects the `this` value to have a `length` property and integer-keyed properties.

## Examples

### Filtering out all small values

The following example uses `filter()` to create a filtered array that has all elements with values less than 10 removed.

```js
function isBigEnough(value) {
  return value >= 10;
}

const filtered = [12, 5, 8, 130, 44].filter(isBigEnough);
// filtered is [12, 130, 44]
```

### Find all prime numbers in an array

The following example returns all prime numbers in the array:

```js
const array = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function isPrime(n) {
  if (n < 2) {
    return false;
  }
  if (n % 2 === 0) {
    return n === 2;
  }
  for (let factor = 3; factor * factor <= n; factor += 2) {
    if (n % factor === 0) {
      return false;
    }
  }
  return true;
}

console.log(array.filter(isPrime)); // [2, 3, 5, 7, 11, 13]
```

> [!NOTE]
> The `isPrime()` implementation is for demonstration only. For a real-world application, you would want to use a heavily memoized algorithm such as the [Sieve of Eratosthenes](https://en.wikipedia.org/wiki/Sieve_of_Eratosthenes) to avoid repeated calculations.

### Filtering invalid objects from an array of objects

The following example uses `filter()` to create a filtered array of all objects with non-zero, numeric `id`.

```js
const arr = [
  { id: 15 },
  { id: -1 },
  { id: 0 },
  { id: 3 },
  { id: 12.2 },
  {},
  { id: null },
  { id: NaN },
  { id: "undefined" },
];

let invalidEntries = 0;

function filterByID(item) {
  if (Number.isFinite(item.id) && item.id !== 0) {
    return true;
  }
  invalidEntries++;
  return false;
}

const arrByID = arr.filter(filterByID);

console.log("Filtered Array\n", arrByID);
// Filtered Array
// [{ id: 15 }, { id: -1 }, { id: 3 }, { id: 12.2 }]

console.log("Number of Invalid Entries =", invalidEntries);
// Number of Invalid Entries = 5
```

### Searching in array

The following example uses `filter()` to filter array content based on search criteria.

```js
const fruits = ["apple", "banana", "grapes", "mango", "orange"];

/**
 * Filter array items based on search criteria (query)
 */
function filterItems(arr, query) {
  return arr.filter((el) => el.toLowerCase().includes(query.toLowerCase()));
}

console.log(filterItems(fruits, "ap")); // ['apple', 'grapes']
console.log(filterItems(fruits, "an")); // ['banana', 'mango', 'orange']
```

### Using the third argument of callbackFn

The `array` argument is useful if you want to access another element in the array, especially when you don't have an existing variable that refers to the array. The following example first uses `map()` to extract the numerical ID from each name and then uses `filter()` to select the ones that are greater than its neighbors.

```js
const names = ["JC63", "Bob132", "Ursula89", "Ben96"];
const greatIDs = names
  .map((name) => parseInt(name.match(/\d+/)[0], 10))
  .filter((id, idx, arr) => {
    // Without the arr argument, there's no way to easily access the
    // intermediate array without saving it to a variable.
    if (idx > 0 && id <= arr[idx - 1]) return false;
    if (idx < arr.length - 1 && id <= arr[idx + 1]) return false;
    return true;
  });
console.log(greatIDs); // [132, 96]
```

The `array` argument is _not_ the array that is being built — there is no way to access the array being built from the callback function.

### Using filter() on sparse arrays

`filter()` will skip empty slots.

```js
console.log([1, , undefined].filter((x) => x === undefined)); // [undefined]
console.log([1, , undefined].filter((x) => x !== 2)); // [1, undefined]
```

### Calling filter() on non-array objects

The `filter()` method reads the `length` property of `this` and then accesses each property whose key is a nonnegative integer less than `length`.

```js
const arrayLike = {
  length: 3,
  0: "a",
  1: "b",
  2: "c",
  3: "a", // ignored by filter() since length is 3
};
console.log(Array.prototype.filter.call(arrayLike, (x) => x <= "b"));
// [ 'a', 'b' ]
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.filter` in `core-js`](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.prototype.filter`](https://www.npmjs.com/package/array.prototype.filter)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.forEach()")}}
- {{jsxref("Array.prototype.every()")}}
- {{jsxref("Array.prototype.map()")}}
- {{jsxref("Array.prototype.some()")}}
- {{jsxref("Array.prototype.reduce()")}}
- {{jsxref("TypedArray.prototype.filter()")}}

# Array.prototype.find


The **`find()`** method of {{jsxref("Array")}} instances returns the first element in the provided array that satisfies the provided testing function.
If no values satisfy the testing function, {{jsxref("undefined")}} is returned.

- If you need the **index** of the found element in the array, use {{jsxref("Array/findIndex", "findIndex()")}}.
- If you need to find the **index of a value**, use {{jsxref("Array/indexOf", "indexOf()")}}.
  (It's similar to {{jsxref("Array/findIndex", "findIndex()")}}, but checks each element for equality with the value instead of using a testing function.)
- If you need to find if a value **exists** in an array, use {{jsxref("Array/includes", "includes()")}}.
  Again, it checks each element for equality with the value instead of using a testing function.
- If you need to find if any element satisfies the provided testing function, use {{jsxref("Array/some", "some()")}}.
- If you need to find all elements that satisfy the provided testing function, use {{jsxref("Array/filter", "filter()")}}.

{{InteractiveExample("JavaScript Demo: Array.prototype.find()", "shorter")}}

```js interactive-example
const array = [5, 12, 8, 130, 44];

const found = array.find((element) => element > 10);

console.log(found);
// Expected output: 12
```

## Syntax

```js-nolint
find(callbackFn)
find(callbackFn, thisArg)
```

### Parameters

- `callbackFn`
  - : A function to execute for each element in the array. It should return a [truthy](/en-US/docs/Glossary/Truthy) value to indicate a matching element has been found, and a [falsy](/en-US/docs/Glossary/Falsy) value otherwise. The function is called with the following arguments:
    - `element`
      - : The current element being processed in the array.
    - `index`
      - : The index of the current element being processed in the array.
    - `array`
      - : The array `find()` was called upon.
- `thisArg` {{optional_inline}}
  - : A value to use as `this` when executing `callbackFn`. See [iterative methods](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods).

### Return value

The first element in the array that satisfies the provided testing function.
Otherwise, {{jsxref("undefined")}} is returned.

## Description

The `find()` method is an [iterative method](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods). It calls a provided `callbackFn` function once for each element in an array in ascending-index order, until `callbackFn` returns a [truthy](/en-US/docs/Glossary/Truthy) value. `find()` then returns that element and stops iterating through the array. If `callbackFn` never returns a truthy value, `find()` returns {{jsxref("undefined")}}. Read the [iterative methods](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods) section for more information about how these methods work in general.

`callbackFn` is invoked for _every_ index of the array, not just those with assigned values. Empty slots in [sparse arrays](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays) behave the same as `undefined`.

The `find()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). It only expects the `this` value to have a `length` property and integer-keyed properties.

## Examples

### Find an object in an array by one of its properties

```js
const inventory = [
  { name: "apples", quantity: 2 },
  { name: "bananas", quantity: 0 },
  { name: "cherries", quantity: 5 },
];

function isCherries(fruit) {
  return fruit.name === "cherries";
}

console.log(inventory.find(isCherries));
// { name: 'cherries', quantity: 5 }
```

#### Using arrow function and destructuring

```js
const inventory = [
  { name: "apples", quantity: 2 },
  { name: "bananas", quantity: 0 },
  { name: "cherries", quantity: 5 },
];

const result = inventory.find(({ name }) => name === "cherries");

console.log(result); // { name: 'cherries', quantity: 5 }
```

### Find the first prime number in an array

The following example returns the first element in the array that is a prime number, or {{jsxref("undefined")}} if there is no prime number.

```js
function isPrime(n) {
  if (n < 2) {
    return false;
  }
  if (n % 2 === 0) {
    return n === 2;
  }
  for (let factor = 3; factor * factor <= n; factor += 2) {
    if (n % factor === 0) {
      return false;
    }
  }
  return true;
}

console.log([4, 6, 8, 12].find(isPrime)); // undefined, not found
console.log([4, 5, 8, 12].find(isPrime)); // 5
```

> [!NOTE]
> The `isPrime()` implementation is for demonstration only. For a real-world application, you would want to use a heavily memoized algorithm such as the [Sieve of Eratosthenes](https://en.wikipedia.org/wiki/Sieve_of_Eratosthenes) to avoid repeated calculations.

### Using the third argument of callbackFn

The `array` argument is useful if you want to access another element in the array, especially when you don't have an existing variable that refers to the array. The following example first uses `filter()` to extract the positive values and then uses `find()` to find the first element that is less than its neighbors.

```js
const numbers = [3, -1, 1, 4, 1, 5, 9, 2, 6];
const firstTrough = numbers
  .filter((num) => num > 0)
  .find((num, idx, arr) => {
    // Without the arr argument, there's no way to easily access the
    // intermediate array without saving it to a variable.
    if (idx > 0 && num >= arr[idx - 1]) return false;
    if (idx < arr.length - 1 && num >= arr[idx + 1]) return false;
    return true;
  });
console.log(firstTrough); // 1
```

### Using find() on sparse arrays

Empty slots in sparse arrays _are_ visited, and are treated the same as `undefined`.

```js
// Declare array with no elements at indexes 2, 3, and 4
const array = [0, 1, , , , 5, 6];

// Shows all indexes, not just those with assigned values
array.find((value, index) => {
  console.log("Visited index", index, "with value", value);
  return false;
});
// Visited index 0 with value 0
// Visited index 1 with value 1
// Visited index 2 with value undefined
// Visited index 3 with value undefined
// Visited index 4 with value undefined
// Visited index 5 with value 5
// Visited index 6 with value 6

// Shows all indexes, including deleted
array.find((value, index) => {
  // Delete element 5 on first iteration
  if (index === 0) {
    console.log("Deleting array[5] with value", array[5]);
    delete array[5];
  }
  // Element 5 is still visited even though deleted
  console.log("Visited index", index, "with value", value);
  return false;
});
// Deleting array[5] with value 5
// Visited index 0 with value 0
// Visited index 1 with value 1
// Visited index 2 with value undefined
// Visited index 3 with value undefined
// Visited index 4 with value undefined
// Visited index 5 with value undefined
// Visited index 6 with value 6
```

### Calling find() on non-array objects

The `find()` method reads the `length` property of `this` and then accesses each property whose key is a nonnegative integer less than `length`.

```js
const arrayLike = {
  length: 3,
  "-1": 0.1, // ignored by find() since -1 < 0
  0: 2,
  1: 7.3,
  2: 4,
};
console.log(Array.prototype.find.call(arrayLike, (x) => !Number.isInteger(x)));
// 7.3
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.find` in `core-js`](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.prototype.find`](https://www.npmjs.com/package/array.prototype.find)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.findIndex()")}}
- {{jsxref("Array.prototype.findLast()")}}
- {{jsxref("Array.prototype.findLastIndex()")}}
- {{jsxref("Array.prototype.includes()")}}
- {{jsxref("Array.prototype.filter()")}}
- {{jsxref("Array.prototype.every()")}}
- {{jsxref("Array.prototype.some()")}}
- {{jsxref("TypedArray.prototype.find()")}}

# Array.prototype.flat


The **`flat()`** method of {{jsxref("Array")}} instances creates a new array with all sub-array
elements concatenated into it recursively up to the specified depth.

{{InteractiveExample("JavaScript Demo: Array.prototype.flat()")}}

```js interactive-example
const arr1 = [0, 1, 2, [3, 4]];

console.log(arr1.flat());
// expected output: Array [0, 1, 2, 3, 4]

const arr2 = [0, 1, [2, [3, [4, 5]]]];

console.log(arr2.flat());
// expected output: Array [0, 1, 2, Array [3, Array [4, 5]]]

console.log(arr2.flat(2));
// expected output: Array [0, 1, 2, 3, Array [4, 5]]

console.log(arr2.flat(Infinity));
// expected output: Array [0, 1, 2, 3, 4, 5]
```

## Syntax

```js-nolint
flat()
flat(depth)
```

### Parameters

- `depth` {{optional_inline}}
  - : The depth level specifying how deep a nested array structure should be flattened.
    Defaults to 1.

### Return value

A new array with the sub-array elements concatenated into it.

## Description

The `flat()` method is a [copying method](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods). It does not alter `this` but instead returns a [shallow copy](/en-US/docs/Glossary/Shallow_copy) that contains the same elements as the ones from the original array.

The `flat()` method removes empty slots if the array being flattened is [sparse](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays). For example, if `depth` is 1, both empty slots in the root array and in the first level of nested arrays are ignored, but empty slots in further nested arrays are preserved with the arrays themselves.

The `flat()` method is [generic](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#generic_array_methods). It only expects the `this` value to have a `length` property and integer-keyed properties. However, its elements must be arrays if they are to be flattened.

## Examples

### Flattening nested arrays

```js
const arr1 = [1, 2, [3, 4]];
arr1.flat();
// [1, 2, 3, 4]

const arr2 = [1, 2, [3, 4, [5, 6]]];
arr2.flat();
// [1, 2, 3, 4, [5, 6]]

const arr3 = [1, 2, [3, 4, [5, 6]]];
arr3.flat(2);
// [1, 2, 3, 4, 5, 6]

const arr4 = [1, 2, [3, 4, [5, 6, [7, 8, [9, 10]]]]];
arr4.flat(Infinity);
// [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

### Using flat() on sparse arrays

The `flat()` method removes [empty slots](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays) in arrays:

```js
const arr5 = [1, 2, , 4, 5];
console.log(arr5.flat()); // [1, 2, 4, 5]

const array = [1, , 3, ["a", , "c"]];
console.log(array.flat()); // [ 1, 3, "a", "c" ]

const array2 = [1, , 3, undefined, ["a", , ["d", , "e"]], null];
console.log(array2.flat()); // [ 1, 3, undefined, "a", ["d", empty, "e"], null ]
console.log(array2.flat(2)); // [ 1, 3, undefined, "a", "d", "e", null ]
```

### Calling flat() on non-array objects

The `flat()` method reads the `length` property of `this` and then accesses each property whose key is a nonnegative integer less than `length`. If the element is not an array, it's directly appended to the result. If the element is an array, it's flattened according to the `depth` parameter.

```js
const arrayLike = {
  length: 3,
  0: [1, 2],
  // Array-like objects aren't flattened
  1: { length: 2, 0: 3, 1: 4 },
  2: 5,
  3: 3, // ignored by flat() since length is 3
};
console.log(Array.prototype.flat.call(arrayLike));
// [ 1, 2, { '0': 3, '1': 4, length: 2 }, 5 ]
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.prototype.flat` in `core-js`](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.prototype.flat`](https://www.npmjs.com/package/array.prototype.flat)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array.prototype.concat()")}}
- {{jsxref("Array.prototype.flatMap()")}}
- {{jsxref("Array.prototype.map()")}}
- {{jsxref("Array.prototype.reduce()")}}

# Array.prototype.from


The **`Array.from()`** static method creates a new, shallow-copied `Array` instance from an [iterable](/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) or [array-like](/en-US/docs/Web/JavaScript/Guide/Indexed_collections#working_with_array-like_objects) object.

{{InteractiveExample("JavaScript Demo: Array.from()", "shorter")}}

```js interactive-example
console.log(Array.from("foo"));
// Expected output: Array ["f", "o", "o"]

console.log(Array.from([1, 2, 3], (x) => x + x));
// Expected output: Array [2, 4, 6]
```

## Syntax

```js-nolint
Array.from(items)
Array.from(items, mapFn)
Array.from(items, mapFn, thisArg)
```

### Parameters

- `items`
  - : An iterable or array-like object to convert to an array.
- `mapFn` {{optional_inline}}
  - : A function to call on every element of the array. If provided, every value to be added to the array is first passed through this function, and `mapFn`'s return value is added to the array instead. The function is called with the following arguments:
    - `element`
      - : The current element being processed in the array.
    - `index`
      - : The index of the current element being processed in the array.
- `thisArg` {{optional_inline}}
  - : Value to use as `this` when executing `mapFn`.

### Return value

A new {{jsxref("Array")}} instance.

## Description

`Array.from()` lets you create `Array`s from:

- [iterable objects](/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) (objects such as {{jsxref("Map")}} and {{jsxref("Set")}}); or, if the object is not iterable,
- array-like objects (objects with a `length` property and indexed elements).

To convert an ordinary object that's not iterable or array-like to an array (by enumerating its property keys, values, or both), use {{jsxref("Object.keys()")}}, {{jsxref("Object.values()")}}, or {{jsxref("Object.entries()")}}. To convert an [async iterable](/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) to an array, use {{jsxref("Array.fromAsync()")}}.

`Array.from()` never creates a sparse array. If the `items` object is missing some index properties, they become `undefined` in the new array.

`Array.from()` has an optional parameter `mapFn`, which allows you to execute a function on each element of the array being created, similar to {{jsxref("Array/map", "map()")}}. More clearly, `Array.from(obj, mapFn, thisArg)` has the same result as `Array.from(obj).map(mapFn, thisArg)`, except that it does not create an intermediate array, and `mapFn` only receives two arguments (`element`, `index`) without the whole array, because the array is still under construction.

> [!NOTE]
> This behavior is more important for [typed arrays](/en-US/docs/Web/JavaScript/Guide/Typed_arrays), since the intermediate array would necessarily have values truncated to fit into the appropriate type. `Array.from()` is implemented to have the same signature as {{jsxref("TypedArray.from()")}}.

The `Array.from()` method is a generic factory method. For example, if a subclass of `Array` inherits the `from()` method, the inherited `from()` method will return new instances of the subclass instead of `Array` instances. In fact, the `this` value can be any constructor function that accepts a single argument representing the length of the new array. When an iterable is passed as `items`, the constructor is called with no arguments; when an array-like object is passed, the constructor is called with the [normalized length](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#normalization_of_the_length_property) of the array-like object. The final `length` will be set again when iteration finishes. If the `this` value is not a constructor function, the plain `Array` constructor is used instead.

## Examples

### Array from a String

```js
Array.from("foo");
// [ "f", "o", "o" ]
```

### Array from a Set

```js
const set = new Set(["foo", "bar", "baz", "foo"]);
Array.from(set);
// [ "foo", "bar", "baz" ]
```

### Array from a Map

```js
const map = new Map([
  [1, 2],
  [2, 4],
  [4, 8],
]);
Array.from(map);
// [[1, 2], [2, 4], [4, 8]]

const mapper = new Map([
  ["1", "a"],
  ["2", "b"],
]);
Array.from(mapper.values());
// ['a', 'b'];

Array.from(mapper.keys());
// ['1', '2'];
```

### Array from a NodeList

```js
// Create an array based on a property of DOM Elements
const images = document.querySelectorAll("img");
const sources = Array.from(images, (image) => image.src);
const insecureSources = sources.filter((link) => link.startsWith("http://"));
```

### Array from an Array-like object (arguments)

```js
function f() {
  return Array.from(arguments);
}

f(1, 2, 3);

// [ 1, 2, 3 ]
```

### Using arrow functions and Array.from()

```js
// Using an arrow function as the map function to
// manipulate the elements
Array.from([1, 2, 3], (x) => x + x);
// [2, 4, 6]

// Generate a sequence of numbers
// Since the array is initialized with `undefined` on each position,
// the value of `v` below will be `undefined`
Array.from({ length: 5 }, (v, i) => i);
// [0, 1, 2, 3, 4]
```

### Sequence generator (range)

```js
// Sequence generator function (commonly referred to as "range", cf. Python, Clojure, etc.)
const range = (start, stop, step) =>
  Array.from(
    { length: Math.ceil((stop - start) / step) },
    (_, i) => start + i * step,
  );

// Generate a sequence of numbers from 0 (inclusive) to 5 (exclusive), incrementing by 1
range(0, 5, 1);
// [0, 1, 2, 3, 4]

// Generate a sequence of numbers from 1 (inclusive) to 10 (exclusive), incrementing by 2
range(1, 10, 2);
// [1, 3, 5, 7, 9]

// Generate the Latin alphabet making use of it being ordered as a sequence
range("A".charCodeAt(0), "Z".charCodeAt(0) + 1, 1).map((x) =>
  String.fromCharCode(x),
);
// ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
```

### Calling from() on non-array constructors

The `from()` method can be called on any constructor function that accepts a single argument representing the length of the new array.

```js
function NotArray(len) {
  console.log("NotArray called with length", len);
}

// Iterable
console.log(Array.from.call(NotArray, new Set(["foo", "bar", "baz"])));
// NotArray called with length undefined
// NotArray { '0': 'foo', '1': 'bar', '2': 'baz', length: 3 }

// Array-like
console.log(Array.from.call(NotArray, { length: 1, 0: "foo" }));
// NotArray called with length 1
// NotArray { '0': 'foo', length: 1 }
```

When the `this` value is not a constructor, a plain `Array` object is returned.

```js
console.log(Array.from.call({}, { length: 1, 0: "foo" })); // [ 'foo' ]
```

## Specifications

{{Specifications}}

## Browser compatibility

{{Compat}}

## See also

- [Polyfill of `Array.from` in `core-js`](https://github.com/zloirock/core-js#ecmascript-array)
- [es-shims polyfill of `Array.from`](https://www.npmjs.com/package/array.from)
- [Indexed collections](/en-US/docs/Web/JavaScript/Guide/Indexed_collections) guide
- {{jsxref("Array")}}
- {{jsxref("Array/Array", "Array()")}}
- {{jsxref("Array.of()")}}
- {{jsxref("Array.fromAsync()")}}
- {{jsxref("Array.prototype.map()")}}
- {{jsxref("TypedArray.from()")}}

