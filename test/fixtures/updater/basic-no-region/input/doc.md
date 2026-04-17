# Basic No Region

Default extraction without region directives:

<?code-excerpt "no_region.html"?>
```html
old
```

Indented extraction from a plain Dart source file:

<?code-excerpt "no_region.dart" indent-by="2"?>
```dart
old
```

Existing block content is replaced regardless of its indentation:

<?code-excerpt "no_region.dart" indent-by="2"?>
```dart
  stale
misindented
```
