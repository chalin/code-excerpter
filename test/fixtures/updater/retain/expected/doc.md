## Test retain transform op

Plain string argument:

<?code-excerpt "basic.dart" retain="$greeting"?>

```dart
void main() => print('$greeting $scope');
```

Regexp argument:

<?code-excerpt "basic.dart" retain="/^v/"?>

```dart
var greeting = 'hello';
var scope = 'world';
void main() => print('$greeting $scope');
```

Plain string of the form `/.../`:

<?code-excerpt "indented_frag.dart" region="single-code-block" retain="\//"?>

```dart
// Fragment is indented by 4 spaces
```
