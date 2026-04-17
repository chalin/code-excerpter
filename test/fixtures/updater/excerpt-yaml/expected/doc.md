## Excerpt YAML tests

Excerpt:

<?code-excerpt "basic.dart" region="var"?>
```dart
var greeting = 'hello';
var scope = 'world';
```

Excerpt full source for which there is no `.excerpt.yaml` file.

<?code-excerpt "basic_0.dart"?>
```dart
var greeting = 'hello';
var scope = 'world';

void main() => print('$greeting $scope');
```

Excerpt from an `.excerpt.yaml` entry with `#border`.

<?code-excerpt "excerpt_getter_with_border.dart" region="trailing blank lines"?>
```dart
var greeting = 'hello';
```
