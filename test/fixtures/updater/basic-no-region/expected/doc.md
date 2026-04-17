# Basic No Region

Default extraction without region directives:

<?code-excerpt "no_region.html"?>
```html
<div>
  <h1>Hello World!</h1>
</div>
```

Indented extraction from a plain Dart source file:

<?code-excerpt "no_region.dart" indent-by="2"?>
```dart
  var greeting = 'hello';
  var scope = 'world';
```

Existing block content is replaced regardless of its indentation:

<?code-excerpt "no_region.dart" indent-by="2"?>
```dart
  var greeting = 'hello';
  var scope = 'world';
```
