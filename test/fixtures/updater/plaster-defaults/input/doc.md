# Plaster Defaults

Languages without a known comment wrapper keep the raw plaster string:

<?code-excerpt "plaster.txt"?>
```
old
```

Known language defaults use language-shaped plaster templates:

<?code-excerpt "plaster.dart"?>
```dart
old
```

<?code-excerpt "plaster.css"?>
```css
old
```

<?code-excerpt "plaster.html"?>
```html
old
```

<?code-excerpt "plaster.yaml"?>
```yaml
old
```

Custom templates override the default template:

<?code-excerpt "plaster.dart" plaster="/*...*/"?>
```dart
old
```

<?code-excerpt "plaster.dart" plaster="/* $defaultPlaster */"?>
```dart
old
```

`plaster="none"` removes plaster lines:

<?code-excerpt "plaster.dart" plaster="none"?>
```dart
old
```
